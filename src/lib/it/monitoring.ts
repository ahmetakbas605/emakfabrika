import 'server-only';
import { eq, and, lt, gte, sql, desc, avg, min, max, count } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  monitorTargets, monitoringMetrics, monitoringAlerts, monitoringAvailability, monitoringMetricsDailyAgg, itAssets
} from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';
import { createIncident } from '@/lib/it/incidents';

// MONITORING.md §3 — aynı target'tan bu süre içinde gelen alert'ler AYNI
// correlation grubunu paylaşır. TODO: CORRELATION_WINDOW_SECONDS'ın
// PDF'in kendi önerdiği değeri (300 sn) — kesinleşmiş bir iş kuralı değil,
// ayarlanabilir bırakıldı.
const CORRELATION_WINDOW_SECONDS = 300;

export interface CreateTargetInput {
  assetId: string;
  targetType: (typeof monitorTargets.$inferInsert)['targetType'];
  credentialId?: string;
  intervalSeconds?: number;
}

export async function createTarget(companyId: string, input: CreateTargetInput): Promise<string> {
  const id = newId();
  await db.insert(monitorTargets).values({ id, companyId, assetId: input.assetId, targetType: input.targetType, credentialId: input.credentialId, intervalSeconds: input.intervalSeconds ?? 300 });
  return id;
}

// lib/it/backup.ts — bir backup job'ının hedef varlığı için henüz bir
// monitor_targets satırı yoksa (izleme AYRICA kurulmamışsa) sessizce bir
// tane oluşturur, VARSA onu yeniden kullanır — bir alert her zaman bir
// target'a bağlı olmak ZORUNDA (monitoring_alerts.target_id NOT NULL),
// backup başarısızlığı da bu kurala tabi.
export async function getOrCreateAssetMonitorTarget(companyId: string, assetId: string): Promise<string> {
  const [existing] = await db.select({ id: monitorTargets.id }).from(monitorTargets).where(and(eq(monitorTargets.companyId, companyId), eq(monitorTargets.assetId, assetId))).limit(1);
  if (existing) return existing.id;
  return createTarget(companyId, { assetId, targetType: 'SERVICE' });
}

export async function listTargets(companyId: string) {
  return db.select({ id: monitorTargets.id, targetType: monitorTargets.targetType, intervalSeconds: monitorTargets.intervalSeconds, active: monitorTargets.active, assetTag: itAssets.assetTag, assetName: itAssets.name })
    .from(monitorTargets).innerJoin(itAssets, eq(itAssets.id, monitorTargets.assetId)).where(eq(monitorTargets.companyId, companyId));
}

// MONITORING.md §7 — eventual consistency: bu tabloya yazım GÜÇLÜ
// transaction disiplinine TABİ DEĞİL (bir metrik satırının kaybolması
// kritik değil), düz INSERT — Muhasebe/Depo'daki postJournal disiplininden
// BİLİNÇLİ olarak farklı, karıştırılmasın diye burada açıkça belirtiliyor.
//
// Gerçek bir collector (NetworkDiscoveryAdapter, NETWORK.md §6) henüz Null
// stub olduğundan, bu fonksiyon bugün YALNIZCA elle ("Ölçüm Ekle" formu)
// veya ileride gerçek bir agent tarafından çağrılır — çağıran taraf
// değişse de bu fonksiyonun kendisi değişmeyecek.
export async function recordMetric(targetId: string, metricName: string, value: number | string): Promise<void> {
  await db.insert(monitoringMetrics).values({ id: newId(), targetId, metricName, value: String(value) });
}

export async function listMetrics(targetId: string, limit = 50) {
  return db.select().from(monitoringMetrics).where(eq(monitoringMetrics.targetId, targetId)).orderBy(desc(monitoringMetrics.recordedAt)).limit(limit);
}

export interface CreateAlertResult {
  alertId: string;
  correlationGroupId: string;
  isFirstInGroup: boolean;
  incidentId?: string;
}

// MONITORING.md §3 — correlation + incident zinciri (madde 76). Aynı
// target'tan CORRELATION_WINDOW_SECONDS içinde açık bir alert varsa AYNI
// gruba katılır (yeni satır yine açılır, ham veri kaybolmaz) ama YENİ bir
// incident açılmaz — grubun İLK alert'i incident'ı zaten açmıştır, sonraki
// alert'ler o incident'a bir work log olarak eklenir.
export async function createAlert(companyId: string, requestedByUserId: string, targetId: string, severity: (typeof monitoringAlerts.$inferInsert)['severity'], message: string): Promise<CreateAlertResult> {
  const windowStart = new Date(Date.now() - CORRELATION_WINDOW_SECONDS * 1000);
  const [recentAlert] = await db
    .select({ correlationGroupId: monitoringAlerts.correlationGroupId, incidentId: monitoringAlerts.incidentId })
    .from(monitoringAlerts)
    .where(and(eq(monitoringAlerts.targetId, targetId), gte(monitoringAlerts.createdAt, windowStart)))
    .orderBy(desc(monitoringAlerts.createdAt))
    .limit(1);

  const isFirstInGroup = !recentAlert;
  const correlationGroupId = recentAlert?.correlationGroupId ?? newId();
  let incidentId = recentAlert?.incidentId ?? undefined;

  if (isFirstInGroup) {
    incidentId = await createIncident(companyId, { title: `[İzleme] ${message}`, description: `Otomatik açılan incident — target: ${targetId}.`, severity: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'HIGH' ? 'HIGH' : 'MEDIUM', openedByUserId: requestedByUserId });
  }

  const alertId = newId();
  await db.insert(monitoringAlerts).values({ id: alertId, targetId, severity, message, correlationGroupId, incidentId });
  return { alertId, correlationGroupId, isFirstInGroup, incidentId };
}

export async function listAlerts(companyId: string) {
  return db
    .select({ id: monitoringAlerts.id, severity: monitoringAlerts.severity, message: monitoringAlerts.message, status: monitoringAlerts.status, correlationGroupId: monitoringAlerts.correlationGroupId, assetTag: itAssets.assetTag, createdAt: monitoringAlerts.createdAt })
    .from(monitoringAlerts)
    .innerJoin(monitorTargets, eq(monitorTargets.id, monitoringAlerts.targetId))
    .innerJoin(itAssets, eq(itAssets.id, monitorTargets.assetId))
    .where(eq(monitorTargets.companyId, companyId))
    .orderBy(desc(monitoringAlerts.createdAt));
}

export async function updateAlertStatus(companyId: string, alertId: string, status: (typeof monitoringAlerts.$inferInsert)['status']): Promise<void> {
  const result = await db
    .update(monitoringAlerts)
    .set({ status })
    .where(and(eq(monitoringAlerts.id, alertId), sql`${monitoringAlerts.targetId} IN (SELECT id FROM ${monitorTargets} WHERE company_id = ${companyId})`));
  if (result[0].affectedRows === 0) throw new ItError('Alert bulunamadı.');
}

// MONITORING.md §5 — bir günün ping/PORT metriklerinden (metricName='up',
// 1/0 değerli) uptime/downtime hesaplar. Metrik aralığı (intervalSeconds)
// her ölçümün "temsil ettiği" süre olarak kabul edilir — TODO:
// AVAILABILITY_GAP_HANDLING (ölçüm hiç gelmemişse o süre downtime mı
// sayılmalı yoksa hariç mi tutulmalı — PDF net değil, bugün "hariç tut"
// varsayımıyla kodlandı, bir TAHMİN değil ama BUSINESS_REVIEW gerektiriyor).
export async function computeDailyAvailability(targetId: string, date: string, intervalSeconds: number): Promise<void> {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);

  const rows = await db
    .select({ value: monitoringMetrics.value })
    .from(monitoringMetrics)
    .where(and(eq(monitoringMetrics.targetId, targetId), eq(monitoringMetrics.metricName, 'up'), gte(monitoringMetrics.recordedAt, dayStart), lt(monitoringMetrics.recordedAt, dayEnd)));

  if (rows.length === 0) return;

  const upCount = rows.filter((r) => Number(r.value) === 1).length;
  const downCount = rows.length - upCount;
  const uptimeSeconds = upCount * intervalSeconds;
  const downtimeSeconds = downCount * intervalSeconds;
  const total = uptimeSeconds + downtimeSeconds;
  const availabilityPercent = total > 0 ? ((uptimeSeconds / total) * 100).toFixed(2) : '0';

  await db
    .insert(monitoringAvailability)
    .values({ id: newId(), targetId, date, uptimeSeconds, downtimeSeconds, availabilityPercent })
    .onDuplicateKeyUpdate({ set: { uptimeSeconds, downtimeSeconds, availabilityPercent } });
}

export async function listAvailability(targetId: string) {
  return db.select().from(monitoringAvailability).where(eq(monitoringAvailability.targetId, targetId)).orderBy(desc(monitoringAvailability.date));
}

const METRIC_RETENTION_DAYS = 30;

// MONITORING.md §4 — 30 günden eski ham metrikleri günlük özet
// (avg/min/max) olarak monitoring_metrics_daily_agg'e yazıp SİLER. Bugün
// partition DROP değil DELETE (TODO: METRICS_PARTITIONING) — küçük/orta
// veri hacminde işlevsel olarak eşdeğer, yalnızca büyük hacimde performans
// farkı doğar.
export async function pruneOldMetrics(companyId: string): Promise<{ aggregatedGroups: number; deletedRows: number }> {
  const cutoff = new Date(Date.now() - METRIC_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const targets = await db.select({ id: monitorTargets.id }).from(monitorTargets).where(eq(monitorTargets.companyId, companyId));
  let aggregatedGroups = 0;
  let deletedRows = 0;

  for (const target of targets) {
    const groups = await db
      .select({
        metricName: monitoringMetrics.metricName,
        date: sql<string>`DATE(${monitoringMetrics.recordedAt})`.as('agg_date'),
        avgValue: avg(monitoringMetrics.value),
        minValue: min(monitoringMetrics.value),
        maxValue: max(monitoringMetrics.value),
        sampleCount: count()
      })
      .from(monitoringMetrics)
      .where(and(eq(monitoringMetrics.targetId, target.id), lt(monitoringMetrics.recordedAt, cutoff)))
      .groupBy(monitoringMetrics.metricName, sql`DATE(${monitoringMetrics.recordedAt})`);

    for (const g of groups) {
      await db
        .insert(monitoringMetricsDailyAgg)
        .values({ id: newId(), targetId: target.id, metricName: g.metricName, date: g.date, avgValue: String(g.avgValue), minValue: String(g.minValue), maxValue: String(g.maxValue), sampleCount: Number(g.sampleCount) })
        .onDuplicateKeyUpdate({ set: { avgValue: String(g.avgValue), minValue: String(g.minValue), maxValue: String(g.maxValue), sampleCount: Number(g.sampleCount) } });
      aggregatedGroups++;
    }

    const deleted = await db.delete(monitoringMetrics).where(and(eq(monitoringMetrics.targetId, target.id), lt(monitoringMetrics.recordedAt, cutoff)));
    deletedRows += deleted[0].affectedRows;
  }

  return { aggregatedGroups, deletedRows };
}
