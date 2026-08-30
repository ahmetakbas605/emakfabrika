import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { approvalInstances } from '@/db/schema';

// Core Security Faz 9 (rapor §09, madde 35 "Approval Tampering
// Protection"). approval_instances.status enum'u DEĞİŞTİRİLMEDİ (bkz.
// schema.ts yorumu, mevcut 10+ documentType'ın status-tabanlı mantığını
// riske atmamak için) — bunun yerine SAF EKLEME bir invalidated bayrağı.
// "Bu onay hâlâ geçerli mi" sorusu ARTIK isApprovalValid ile sorulmalı,
// yalnızca status==='APPROVED' YETERLİ DEĞİL.

export async function isApprovalValid(companyId: string, documentType: string, documentId: string): Promise<boolean> {
  const [instance] = await db.select({ status: approvalInstances.status, invalidated: approvalInstances.invalidated }).from(approvalInstances).where(and(eq(approvalInstances.companyId, companyId), eq(approvalInstances.documentType, documentType), eq(approvalInstances.documentId, documentId))).limit(1);
  if (!instance) return false;
  return instance.status === 'APPROVED' && !instance.invalidated;
}

// Onaylanmış bir belgenin KRİTİK bir alanı (tutar, personel, hesap...)
// APPROVED sonrasında değişirse çağrılır — mevcut onayı geçersiz kılar,
// yeni bir submit/startApprovalInTx akışının GEREKLİ olduğunu işaretler
// (çağıran taraf bunu kendi durum makinesine göre tetikler).
export async function invalidateApproval(tx: Tx | typeof db, companyId: string, documentType: string, documentId: string, reason: string): Promise<void> {
  await tx.update(approvalInstances).set({ invalidated: true, invalidatedAt: new Date(), invalidatedReason: reason }).where(and(eq(approvalInstances.companyId, companyId), eq(approvalInstances.documentType, documentType), eq(approvalInstances.documentId, documentId), eq(approvalInstances.status, 'APPROVED')));
}
