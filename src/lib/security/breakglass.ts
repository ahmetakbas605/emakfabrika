import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { breakGlassAccess } from '@/db/schema';
import { newId } from '@/lib/id';
import { SecurityError } from './errors';
import { writeAuditLog } from './audit';

// Core Security Faz 10 (rapor §09, madde 38-39). isFactoryAdmin ZATEN
// koşulsuz tam yetki taşıyor (requireDepartmentAccess fallback'i, tek-
// fabrika kurulumda madde 65'in "platform yöneticisi" karşılığı) — bu
// tablo o yetkiyi KISITLAMIYOR, yalnızca "normal iş akışı dışında,
// gerekçeli bir erişim" senaryosunu LOGLANABİLİR kılıyor. Gerçek bir
// erişim ENGELLEME/ZORLAMA mekanizması (madde 39'un "erişim otomatik sona
// ersin" vaadinin teknik icrası) bu fazın kapsamı DIŞINDA — rapor §12'nin
// kendi notu, ileri bir faz.

export interface RequestBreakGlassInput {
  reason: string;
  ticketReference?: string;
  scope?: string;
}

export async function requestBreakGlassAccess(companyId: string, requestedByUserId: string, input: RequestBreakGlassInput): Promise<string> {
  const id = newId();
  await db.insert(breakGlassAccess).values({ id, companyId, requestedByUserId, reason: input.reason, ticketReference: input.ticketReference ?? '', scope: input.scope ?? '' });
  await writeAuditLog({ companyId, userId: requestedByUserId, action: 'BREAK_GLASS_ACCESS', entity: 'BREAK_GLASS_ACCESS', entityId: id, module: 'SECURITY', riskLevel: 'CRITICAL', newValue: input });
  return id;
}

export async function approveBreakGlassAccess(companyId: string, accessId: string, approvedByUserId: string, durationHours: number): Promise<void> {
  const [row] = await db.select({ id: breakGlassAccess.id, status: breakGlassAccess.status }).from(breakGlassAccess).where(and(eq(breakGlassAccess.id, accessId), eq(breakGlassAccess.companyId, companyId))).limit(1);
  if (!row) throw new SecurityError('Break-glass talebi bulunamadı.');
  if (row.status !== 'PENDING') throw new SecurityError('Yalnızca bekleyen bir talep onaylanabilir.');

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000);
  await db.update(breakGlassAccess).set({ status: 'ACTIVE', approvedByUserId, startAt, endAt }).where(eq(breakGlassAccess.id, accessId));
  await writeAuditLog({ companyId, userId: approvedByUserId, action: 'BREAK_GLASS_ACCESS', entity: 'BREAK_GLASS_ACCESS', entityId: accessId, module: 'SECURITY', riskLevel: 'CRITICAL', changedFields: { status: 'ACTIVE', durationHours } });
}

export async function revokeBreakGlassAccess(companyId: string, accessId: string): Promise<void> {
  const [row] = await db.select({ id: breakGlassAccess.id }).from(breakGlassAccess).where(and(eq(breakGlassAccess.id, accessId), eq(breakGlassAccess.companyId, companyId))).limit(1);
  if (!row) throw new SecurityError('Break-glass talebi bulunamadı.');
  await db.update(breakGlassAccess).set({ status: 'REVOKED' }).where(eq(breakGlassAccess.id, accessId));
}

export async function listBreakGlassAccess(companyId: string) {
  const rows = await db.select().from(breakGlassAccess).where(eq(breakGlassAccess.companyId, companyId));
  const now = Date.now();
  // expired olanları otomatik işaretle (arka plan job'u yok — okuma anında hesaplanır)
  for (const row of rows) {
    if (row.status === 'ACTIVE' && row.endAt && row.endAt.getTime() < now) row.status = 'EXPIRED';
  }
  return rows;
}
