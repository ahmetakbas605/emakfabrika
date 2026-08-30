import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { dataSubjectRequests, approvalSteps, approvalInstances, DSR_TYPES } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { isUnderLegalHold } from './retention';
import { SecurityError } from './errors';

// Core Security Faz 8 (rapor §09, madde 22) — KVKK Veri Sahibi Talepleri.
// leave_requests/bonus_requests İLE BİREBİR AYNI desen (create-draft →
// AYRI submit → jenerik workflow motoruna documentType='DATA_SUBJECT_REQUEST').

export interface CreateDsrInput {
  requestType: (typeof DSR_TYPES)[number];
  subjectName: string;
  subjectIdentifier?: string;
  relatedEmployeeId?: string;
  description: string;
}

export async function createDataSubjectRequest(companyId: string, createdByUserId: string, input: CreateDsrInput): Promise<string> {
  return db.transaction(async (tx) => {
    const id = newId();
    const requestNo = await nextDocumentNo(tx, companyId, 'DSR', 'DSR', new Date().getFullYear(), 6);
    await tx.insert(dataSubjectRequests).values({ id, companyId, requestNo, requestType: input.requestType, subjectName: input.subjectName, subjectIdentifier: input.subjectIdentifier ?? '', relatedEmployeeId: input.relatedEmployeeId, description: input.description, createdByUserId });
    return id;
  });
}

export async function listDataSubjectRequests(companyId: string) {
  return db.select().from(dataSubjectRequests).where(eq(dataSubjectRequests.companyId, companyId)).orderBy(desc(dataSubjectRequests.createdAt));
}

export async function submitDataSubjectRequest(companyId: string, requestId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(dataSubjectRequests).where(and(eq(dataSubjectRequests.id, requestId), eq(dataSubjectRequests.companyId, companyId))).limit(1);
    if (!row) throw new SecurityError('KVKK talebi bulunamadı.');
    if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new SecurityError(`${row.status} durumundaki bir talep gönderilemez.`);

    await startApprovalInTx(tx, companyId, 'DATA_SUBJECT_REQUEST', requestId, userId, {});
    await tx.update(dataSubjectRequests).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(dataSubjectRequests.id, requestId));
  });
}

export interface ActOnDsrStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnDsrStep(companyId: string, input: ActOnDsrStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new SecurityError('Onay adımı bulunamadı.');
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(eq(approvalInstances.id, step.instanceId)).limit(1);
    if (!instance || instance.documentType !== 'DATA_SUBJECT_REQUEST') throw new SecurityError('Bu adım bir KVKK talebine ait değil.');
    const requestId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(dataSubjectRequests).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(dataSubjectRequests.id, requestId));
      return;
    }
    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(dataSubjectRequests).set({ status: newStatus, completedAt: new Date() }).where(eq(dataSubjectRequests.id, requestId));
  });
}

// madde 24 (retention.ts:isUnderLegalHold'ın GERÇEK tüketicisi) — bir
// silme (DELETION) talebi APPROVED olsa bile, ilgili kişi/kayıt aktif bir
// legal hold altındaysa "tamamlandı" olarak İŞARETLENEMEZ (personel bu
// engeli görüp önce hold'u kaldırmalı/legal ile görüşmeli). ACCESS/
// CORRECTION gibi silme İÇERMEYEN talep türleri bu kontrolden ETKİLENMEZ.
export async function resolveDataSubjectRequest(companyId: string, requestId: string, note: string): Promise<void> {
  const [row] = await db.select({ id: dataSubjectRequests.id, status: dataSubjectRequests.status, requestType: dataSubjectRequests.requestType, relatedEmployeeId: dataSubjectRequests.relatedEmployeeId }).from(dataSubjectRequests).where(and(eq(dataSubjectRequests.id, requestId), eq(dataSubjectRequests.companyId, companyId))).limit(1);
  if (!row) throw new SecurityError('KVKK talebi bulunamadı.');
  if (row.status !== 'APPROVED') throw new SecurityError('Yalnızca onaylanmış bir talep tamamlanmış olarak işaretlenebilir.');

  if (row.requestType === 'DELETION' && row.relatedEmployeeId) {
    const held = await isUnderLegalHold(companyId, 'EMPLOYEE', row.relatedEmployeeId);
    if (held) throw new SecurityError('Bu kişi aktif bir legal hold altında — silme talebi, hold kaldırılmadan tamamlanmış olarak işaretlenemez.');
  }

  await db.update(dataSubjectRequests).set({ resolutionNote: note }).where(eq(dataSubjectRequests.id, requestId));
}
