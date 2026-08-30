import 'server-only';
import { eq, and, desc, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { securityEvents, SECURITY_EVENT_TYPES, SECURITY_EVENT_STATUSES } from '@/db/schema';
import { newId } from '@/lib/id';
import type { AuditRiskLevel } from './audit';
import { SecurityError } from './errors';

// Core Security Faz 6 (rapor §07, madde 27-29) — basit eşik-tabanlı risk
// motoru. Gerçek bir arka plan işi/kuyruk YOK (bu oturumun kapsamı dışı,
// rapor §12'nin "kapsam dışı" listesi) — bu fonksiyonlar SENKRON olarak,
// ilgili işlemin İÇİNDEN çağrılır (örn. bir export fonksiyonu kendi satır
// sayısını kontrol edip gerektiğinde recordSecurityEvent çağırır).

export interface RecordSecurityEventInput {
  eventType: (typeof SECURITY_EVENT_TYPES)[number];
  riskLevel: AuditRiskLevel;
  actedByUserId?: string;
  description: string;
  metadata?: unknown;
}

export async function recordSecurityEvent(companyId: string, input: RecordSecurityEventInput): Promise<string> {
  const id = newId();
  await db.insert(securityEvents).values({ id, companyId, eventType: input.eventType, riskLevel: input.riskLevel, actedByUserId: input.actedByUserId, description: input.description, metadata: input.metadata });
  return id;
}

export async function listSecurityEvents(companyId: string, status?: (typeof SECURITY_EVENT_STATUSES)[number]) {
  const conditions = status ? and(eq(securityEvents.companyId, companyId), eq(securityEvents.status, status)) : eq(securityEvents.companyId, companyId);
  return db.select().from(securityEvents).where(conditions).orderBy(desc(securityEvents.createdAt)).limit(500);
}

export async function resolveSecurityEvent(companyId: string, eventId: string, resolvedByUserId: string, status: 'RESOLVED' | 'FALSE_POSITIVE', note?: string): Promise<void> {
  const [event] = await db.select({ id: securityEvents.id }).from(securityEvents).where(and(eq(securityEvents.id, eventId), eq(securityEvents.companyId, companyId))).limit(1);
  if (!event) throw new SecurityError('Güvenlik olayı bulunamadı.');
  await db.update(securityEvents).set({ status, resolvedByUserId, resolvedAt: new Date(), resolutionNote: note }).where(eq(securityEvents.id, eventId));
}

// madde 28 — eşik-tabanlı basit kural: X dakikada Y'den fazla başarısız
// giriş → REPEATED_FAILED_LOGIN. Şu an yalnızca export/mass-export
// senaryosu (lib/security/exportControl.ts) buna bağlı; login tarafı
// zaten failedLoginAttempts sayacı + 5-hata kilidiyle KENDİ eşiğini
// uyguluyor (bkz. actions/auth.ts) — burada TEKRAR bir güvenlik olayı
// üretmek gürültü olurdu, bilinçli olarak eklenmedi.
export async function checkMassExportThreshold(companyId: string, userId: string, rowCount: number, threshold: number): Promise<void> {
  if (rowCount <= threshold) return;
  await recordSecurityEvent(companyId, { eventType: 'MASS_EXPORT', riskLevel: 'CRITICAL', actedByUserId: userId, description: `Toplu export eşiği aşıldı: ${rowCount} kayıt (eşik: ${threshold}).`, metadata: { rowCount, threshold } });
}

export function isOffHours(at: Date = new Date()): boolean {
  const hour = at.getHours();
  const day = at.getDay();
  return hour < 7 || hour >= 20 || day === 0 || day === 6;
}
