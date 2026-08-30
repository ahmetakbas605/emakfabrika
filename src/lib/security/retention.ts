import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { retentionPolicies, legalHolds, RETENTION_DELETE_METHODS } from '@/db/schema';
import { newId } from '@/lib/id';
import { SecurityError } from './errors';

// Core Security Faz 7 (rapor §08, madde 23-26). Süre değerleri KOD İÇİNE
// GÖMÜLMEZ — bkz. şema yorumu. Gerçek otomatik silme/anonimleştirme
// job'u (arka plan kuyruğu, rapor §12'nin kapsam dışı listesi) bu
// fazın kapsamı DEĞİL — bu yalnızca politika TANIMLAMA + legal hold
// kontrolü (bir kaydın silinip silinemeyeceğini SORGULAMA).

export interface CreateRetentionPolicyInput {
  dataType: string;
  legalBasis?: string;
  retentionYears: number;
  startEvent?: string;
  deleteMethod?: (typeof RETENTION_DELETE_METHODS)[number];
  legalHoldSupported?: boolean;
}

export async function createRetentionPolicy(companyId: string, input: CreateRetentionPolicyInput): Promise<string> {
  if (input.retentionYears <= 0) throw new SecurityError('Saklama süresi 0\'dan büyük olmalı.');
  const id = newId();
  await db
    .insert(retentionPolicies)
    .values({ id, companyId, dataType: input.dataType, legalBasis: input.legalBasis ?? '', retentionYears: input.retentionYears, startEvent: input.startEvent ?? '', deleteMethod: input.deleteMethod ?? 'ANONYMIZE', legalHoldSupported: input.legalHoldSupported ?? true })
    .onDuplicateKeyUpdate({ set: { legalBasis: input.legalBasis ?? '', retentionYears: input.retentionYears, startEvent: input.startEvent ?? '', deleteMethod: input.deleteMethod ?? 'ANONYMIZE' } });
  return id;
}

export async function listRetentionPolicies(companyId: string) {
  return db.select().from(retentionPolicies).where(and(eq(retentionPolicies.companyId, companyId), eq(retentionPolicies.active, true)));
}

export interface CreateLegalHoldInput {
  entityType: string;
  entityId: string;
  reason: string;
}

export async function createLegalHold(companyId: string, createdByUserId: string, input: CreateLegalHoldInput): Promise<string> {
  const id = newId();
  await db.insert(legalHolds).values({ id, companyId, entityType: input.entityType, entityId: input.entityId, reason: input.reason, createdByUserId });
  return id;
}

export async function releaseLegalHold(companyId: string, legalHoldId: string): Promise<void> {
  const [hold] = await db.select({ id: legalHolds.id }).from(legalHolds).where(and(eq(legalHolds.id, legalHoldId), eq(legalHolds.companyId, companyId))).limit(1);
  if (!hold) throw new SecurityError('Legal hold bulunamadı.');
  await db.update(legalHolds).set({ active: false, releasedAt: new Date() }).where(eq(legalHolds.id, legalHoldId));
}

export async function listActiveLegalHolds(companyId: string) {
  return db.select().from(legalHolds).where(and(eq(legalHolds.companyId, companyId), eq(legalHolds.active, true)));
}

// madde 24 — bir kaydın silinip silinemeyeceğinin GERÇEK sorgusu: aktif
// bir legal hold varsa silme/anonimleştirme ENGELLENİR.
export async function isUnderLegalHold(companyId: string, entityType: string, entityId: string): Promise<boolean> {
  const [hold] = await db.select({ id: legalHolds.id }).from(legalHolds).where(and(eq(legalHolds.companyId, companyId), eq(legalHolds.entityType, entityType), eq(legalHolds.entityId, entityId), eq(legalHolds.active, true))).limit(1);
  return !!hold;
}
