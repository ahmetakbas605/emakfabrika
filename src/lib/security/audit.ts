import 'server-only';
import crypto from 'crypto';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { auditLogs, AUDIT_RISK_LEVELS, AUDIT_RESULTS } from '@/db/schema';
import { newId } from '@/lib/id';

// Core Security Faz 1-2 (rapor §06) — merkezi audit yazıcı. Yayınlandığı
// günden bu yana yalnızca lib/accounting.ts'in 2 yerinde kullanılan
// audit_logs tablosunun GERÇEK tüketicisi. Kritik olay listesi (rapor
// §74/madde 74) burada AŞAMALI olarak genişletiliyor — her fonksiyonun
// kendi mutasyonunu audit etmesi bu oturumun kapsamı, "her SELECT" değil.

export type AuditRiskLevel = (typeof AUDIT_RISK_LEVELS)[number];
export type AuditResult = (typeof AUDIT_RESULTS)[number];

// GERÇEK bulgu (2026-08-30, Playwright smoke test'te yakalandı): MySQL'in
// JSON kolon tipi, bir değeri geri OKURKEN nesne anahtarlarını ALFABETİK
// SIRAYA sokuyor — INSERT'ten önceki JS nesnesinin anahtar sırasıyla AYNI
// KALMIYOR. writeAuditLog hash'i INSERT'ten ÖNCEKİ (orijinal sıra) nesneye
// göre hesaplıyordu, verifyAuditChain ise DB'den OKUNAN (alfabetik sıralı)
// satıra göre yeniden hesaplıyordu — aynı içerik, FARKLI JSON.stringify
// çıktısı, "zincir bozuk" YANLIŞ POZİTİFİ. Çözüm: her ikisi de nesne
// anahtarlarını REKÜRSİF olarak alfabetik sıraya sokan AYNI kanonik
// serileştiriciyi kullanır — MySQL'in kendi davranışıyla TUTARLI, hash
// artık sütun tipinin round-trip'inden BAĞIMSIZ.
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return value;
}

export interface WriteAuditLogInput {
  companyId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedFields?: unknown;
  ip?: string;
  device?: string;
  module?: string;
  sessionId?: string;
  correlationId?: string;
  riskLevel?: AuditRiskLevel;
  result?: AuditResult;
}

// madde 13 — hash zinciri. NOT: previousHash "şirketin en son audit
// satırı" sorgusuyla okunuyor — çok YÜKSEK eşzamanlılıkta (aynı anda
// birden fazla yazma) teorik olarak aynı previousHash'i paylaşan iki
// satır oluşabilir (blockchain'deki gibi katı bir sıra kilidi YOK,
// bilinçli bir basitleştirme — bu bir tek-fabrika ERP'si, saniyede
// binlerce audit yazması beklenmiyor). Amaç yine de korunuyor: bir satırın
// SONRADAN değiştirildiği, kendi hash'ini bozarak tespit edilebilir.
export async function writeAuditLog(input: WriteAuditLogInput, tx?: Tx): Promise<string> {
  const executor = (tx ?? db) as Tx;
  const id = newId();

  const [last] = await executor.select({ currentHash: auditLogs.currentHash }).from(auditLogs).where(eq(auditLogs.companyId, input.companyId)).orderBy(desc(auditLogs.createdAt)).limit(1);
  const previousHash = last?.currentHash ?? null;

  const canonical = canonicalJson({
    companyId: input.companyId, userId: input.userId ?? null, action: input.action, entity: input.entity, entityId: input.entityId ?? null,
    oldValue: input.oldValue ?? null, newValue: input.newValue ?? null, previousHash
  });
  const currentHash = crypto.createHash('sha256').update(canonical).digest('hex');

  await executor.insert(auditLogs).values({
    id, companyId: input.companyId, userId: input.userId ?? null, action: input.action, entity: input.entity, entityId: input.entityId,
    oldValue: input.oldValue, newValue: input.newValue, changedFields: input.changedFields, ip: input.ip, device: input.device,
    module: input.module, sessionId: input.sessionId, correlationId: input.correlationId,
    riskLevel: input.riskLevel ?? 'LOW', result: input.result ?? 'SUCCESS', previousHash, currentHash
  });
  return id;
}

export async function listAuditLogs(companyId: string, filter?: { entity?: string; userId?: string; from?: Date; to?: Date; riskLevel?: AuditRiskLevel }) {
  const conditions = [eq(auditLogs.companyId, companyId)];
  if (filter?.entity) conditions.push(eq(auditLogs.entity, filter.entity));
  if (filter?.userId) conditions.push(eq(auditLogs.userId, filter.userId));
  if (filter?.riskLevel) conditions.push(eq(auditLogs.riskLevel, filter.riskLevel));
  if (filter?.from) conditions.push(gte(auditLogs.createdAt, filter.from));
  if (filter?.to) conditions.push(lte(auditLogs.createdAt, filter.to));

  return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(500);
}

export interface ChainVerificationResult {
  ok: boolean;
  checked: number;
  skippedLegacy: number;
  brokenAtId: string | null;
}

// madde 13'ün "zincir bozulursa tespit edilebilir" vaadinin GERÇEK
// karşılığı — her satırın hash'ini yeniden hesaplayıp kayıtlıyla
// karşılaştırır, VE bir sonraki satırın previousHash'inin bununla
// eşleştiğini doğrular. GERÇEK bulgu (2026-08-30, Playwright smoke test'te
// yakalandı): lib/accounting.ts'in bu tablodaki ÖNCEDEN VAR OLAN 2 yazması
// (bu oturumun Faz 1'inden ÖNCE, hash zinciri hiç yokken eklenmişti)
// previousHash/currentHash'i hiç doldurmuyordu — bu "eski" (zincir-öncesi)
// satırları GERÇEK bir müdahaleyle KARIŞTIRMAMAK için, currentHash'i NULL
// olan satırlar "legacy" sayılıp atlanır, zincir doğrulaması hash'i olan
// İLK satırdan başlar.
export async function verifyAuditChain(companyId: string): Promise<ChainVerificationResult> {
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(auditLogs.createdAt);
  let expectedPrevious: string | null = null;
  let checked = 0;
  let skippedLegacy = 0;
  let chainStarted = false;

  for (const row of rows) {
    if (!chainStarted && row.currentHash === null) {
      skippedLegacy++;
      continue;
    }
    chainStarted = true;

    const canonical = canonicalJson({
      companyId: row.companyId, userId: row.userId ?? null, action: row.action, entity: row.entity, entityId: row.entityId ?? null,
      oldValue: row.oldValue ?? null, newValue: row.newValue ?? null, previousHash: row.previousHash ?? null
    });
    const recomputed = crypto.createHash('sha256').update(canonical).digest('hex');
    if (row.previousHash !== expectedPrevious || row.currentHash !== recomputed) {
      return { ok: false, checked, skippedLegacy, brokenAtId: row.id };
    }
    expectedPrevious = row.currentHash;
    checked++;
  }
  return { ok: true, checked, skippedLegacy, brokenAtId: null };
}

// rapor §07 — işlem türüne göre risk skoru. Yeni kritik işlemler burada
// tek bir yerden genişletilir.
export const ACTION_RISK_MAP: Record<string, AuditRiskLevel> = {
  LOGIN: 'LOW', LOGOUT: 'LOW', LOGIN_FAILED: 'MEDIUM',
  DATA_VIEW: 'LOW', SENSITIVE_DATA_VIEW: 'MEDIUM',
  CREATE: 'LOW', UPDATE: 'LOW', DELETE: 'MEDIUM',
  EXPORT: 'HIGH', SENSITIVE_EXPORT: 'CRITICAL', MASS_EXPORT: 'CRITICAL',
  APPROVAL: 'MEDIUM', REJECTION: 'MEDIUM',
  ROLE_CHANGED: 'CRITICAL', PERMISSION_CHANGED: 'CRITICAL',
  MFA_CHANGED: 'HIGH', PASSWORD_CHANGED: 'HIGH',
  BREAK_GLASS_ACCESS: 'CRITICAL', LEGAL_HOLD_CHANGED: 'HIGH', RETENTION_POLICY_CHANGED: 'HIGH'
};
