import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { companies, departments, users, monitorTargets } from '@/db/schema';
import { runDueMaintenanceGeneration } from '@/lib/it/maintenance';
import { checkAndEscalateOverdueTickets } from '@/lib/it/escalation';
import { computeDailyAvailability, pruneOldMetrics } from '@/lib/it/monitoring';

// TODO: SCHEDULER_INFRASTRUCTURE'ın ÇÖZÜMÜ — kullanıcının kararı: "kendi
// içinde bir node kaydet ve oradan takip et tetikle" — yani fabrikanın
// kendi sunucusunda 7/24 çalışan bir Node sürecinin GARANTİSİ VAR
// varsayımıyla, harici bir cron/OS zamanlayıcı yerine BU sürecin kendi
// içinde (src/instrumentation.ts:register() ile başlatılan) bir
// setInterval döngüsü. SERVICE-DESK.md §8 (SLA eskalasyonu) ve
// MAINTENANCE.md §2'nin (otomatik work order üretimi) ikisi de bu tek
// altyapıyı paylaşır — MONITORING.md §4 geldiğinde de aynı desene eklenir.
//
// Bu döngü çakışan (overlapping) çalışmalara karşı `isRunning` bayrağıyla
// korunuyor — bir tur bitmeden yenisi başlamaz (uzun süren bir DB
// sorgusu/kilit varsa döngü kendini yığmaz).
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 dakika

interface SchedulerState {
  intervalHandle: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  lastRunAt: Date | null;
  lastResult: { companiesProcessed: number; maintenanceGenerated: number; escalated: number; metricsPruned: number; errors: string[] } | null;
  runCount: number;
}

const state: SchedulerState = { intervalHandle: null, isRunning: false, lastRunAt: null, lastResult: null, runCount: 0 };

// MONITORING.md §4-5 — dünün (tam biten son gün) availability'sini
// hesaplar + 30 günden eski ham metrikleri özetleyip siler. Bugünün
// verisi henüz TAMAMLANMADIĞI için hesaplanmaz (yarım bir günün
// availability_percent'i yanıltıcı olurdu).
async function runMonitoringTasksForCompany(companyId: string): Promise<number> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const targets = await db.select({ id: monitorTargets.id, intervalSeconds: monitorTargets.intervalSeconds }).from(monitorTargets).where(and(eq(monitorTargets.companyId, companyId), eq(monitorTargets.active, true)));
  for (const target of targets) {
    await computeDailyAvailability(target.id, yesterday, target.intervalSeconds);
  }
  const pruneResult = await pruneOldMetrics(companyId);
  return pruneResult.deletedRows;
}

async function runOnceForCompany(companyId: string): Promise<{ maintenanceGenerated: number; escalated: number; metricsPruned: number }> {
  const [itDept] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.companyId, companyId), eq(departments.departmentTypeCode, 'IT'), eq(departments.active, true))).limit(1);
  const [systemUser] = await db.select({ id: users.id }).from(users).where(and(eq(users.companyId, companyId), eq(users.isFactoryAdmin, true), eq(users.active, true))).limit(1);

  let maintenanceGenerated = 0;
  if (systemUser) {
    // Holding ERP Faz 6 (EAM) — itDept yalnızca FALLBACK'tir (departmanı
    // BOŞ olan eski IT planları için, geriye uyumlu); IT departmanı
    // olmayan bir şirkette bile EAM planları üretilebilsin diye herhangi
    // bir aktif departman yeterli — gerçek EAM planları zaten KENDİ
    // departmanını taşır (lib/it/maintenance.ts:runDueMaintenanceGeneration'ın
    // kendi yorumu), bu fallback onlar için hiç kullanılmaz.
    const [fallbackDept] = itDept ? [itDept] : await db.select({ id: departments.id }).from(departments).where(and(eq(departments.companyId, companyId), eq(departments.active, true))).limit(1);
    if (fallbackDept) {
      const result = await runDueMaintenanceGeneration(companyId, fallbackDept.id, systemUser.id);
      maintenanceGenerated = result.generatedCount;
    }
  }
  // Eskalasyon IT departmanından bağımsız — companyId yeterli.
  const escalationResult = await checkAndEscalateOverdueTickets(companyId);
  const metricsPruned = await runMonitoringTasksForCompany(companyId);
  return { maintenanceGenerated, escalated: escalationResult.escalatedCount, metricsPruned };
}

// Manuel tetikleme (buton) VE gerçek periyodik döngü AYNI fonksiyonu
// çağırır — davranış birebir aynı, "elle" ile "otomatik" arasında kod
// farkı yok.
export async function runSchedulerTasksOnce(): Promise<SchedulerState['lastResult']> {
  if (state.isRunning) return state.lastResult;
  state.isRunning = true;
  const errors: string[] = [];
  let maintenanceGenerated = 0;
  let escalated = 0;
  let metricsPruned = 0;
  let companiesProcessed = 0;

  try {
    const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
    for (const company of allCompanies) {
      try {
        const result = await runOnceForCompany(company.id);
        maintenanceGenerated += result.maintenanceGenerated;
        escalated += result.escalated;
        metricsPruned += result.metricsPruned;
        companiesProcessed++;
      } catch (err) {
        errors.push(`${company.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    state.isRunning = false;
    state.lastRunAt = new Date();
    state.runCount++;
    state.lastResult = { companiesProcessed, maintenanceGenerated, escalated, metricsPruned, errors };
  }
  return state.lastResult;
}

export function getSchedulerStatus() {
  return { lastRunAt: state.lastRunAt, lastResult: state.lastResult, runCount: state.runCount, isRunning: state.isRunning, intervalMs: getIntervalMs() };
}

function getIntervalMs(): number {
  const fromEnv = Number(process.env.SCHEDULER_INTERVAL_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_INTERVAL_MS;
}

// src/instrumentation.ts:register() tarafından, sunucu başlarken BİR KEZ
// çağrılır. Zaten çalışan bir döngü varsa (hot-reload vb.) tekrar başlatmaz.
export function startScheduler(): void {
  if (state.intervalHandle) return;
  const intervalMs = getIntervalMs();
  state.intervalHandle = setInterval(() => {
    runSchedulerTasksOnce().catch((err) => {
      console.error('[scheduler] periyodik çalışma başarısız:', err);
    });
  }, intervalMs);
  // Node process'in yalnızca bu interval yüzünden açık kalmasını önle —
  // testte/kısa ömürlü scriptlerde process'in kapanmasını engellemesin.
  state.intervalHandle.unref?.();
  console.log(`[scheduler] başlatıldı — her ${intervalMs / 1000} saniyede bir çalışacak.`);
}
