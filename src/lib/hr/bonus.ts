import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { bonusRequests, employees, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { HrError } from './errors';

// İK Faz 5 — documentType='BONUS'. lib/hr/leave.ts'in submitLeaveRequest/
// actOnLeaveStep'i İLE BİREBİR AYNI desen (workflow/engine.ts SIFIR
// değişti).

export interface CreateBonusRequestInput {
  bonusType: 'PERFORMANCE' | 'HOLIDAY' | 'REFERRAL' | 'RETENTION' | 'OTHER';
  amount: number;
  currencyCode: string;
  reason?: string;
}

export async function createBonusRequest(companyId: string, employeeId: string, createdByUserId: string, input: CreateBonusRequestInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  if (input.amount <= 0) throw new HrError('Tutar 0\'dan büyük olmalı.');

  return db.transaction(async (tx) => {
    const id = newId();
    const bonusNo = await nextDocumentNo(tx, companyId, 'BONUS', 'BN', new Date().getFullYear(), 6);
    await tx.insert(bonusRequests).values({ id, companyId, bonusNo, employeeId, bonusType: input.bonusType, amount: String(input.amount), currencyCode: input.currencyCode, reason: input.reason, createdByUserId });
    return id;
  });
}

export async function listBonusRequests(companyId: string, employeeId?: string) {
  const conditions = employeeId ? and(eq(bonusRequests.companyId, companyId), eq(bonusRequests.employeeId, employeeId)) : eq(bonusRequests.companyId, companyId);
  return db
    .select({
      id: bonusRequests.id, bonusNo: bonusRequests.bonusNo, employeeId: bonusRequests.employeeId,
      employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      bonusType: bonusRequests.bonusType, amount: bonusRequests.amount, currencyCode: bonusRequests.currencyCode, status: bonusRequests.status, createdAt: bonusRequests.createdAt
    })
    .from(bonusRequests)
    .innerJoin(employees, eq(employees.id, bonusRequests.employeeId))
    .where(conditions)
    .orderBy(desc(bonusRequests.createdAt));
}

export async function cancelBonusRequest(companyId: string, bonusRequestId: string, userId: string): Promise<void> {
  const [row] = await db.select().from(bonusRequests).where(and(eq(bonusRequests.id, bonusRequestId), eq(bonusRequests.companyId, companyId))).limit(1);
  if (!row) throw new HrError('Ödül talebi bulunamadı.');
  if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError('Yalnızca taslak veya değişiklik bekleyen bir ödül talebi iptal edilebilir.');
  if (row.createdByUserId !== userId) throw new HrError('Yalnızca talebi oluşturan kişi iptal edebilir.');
  await db.update(bonusRequests).set({ status: 'CANCELLED' }).where(eq(bonusRequests.id, bonusRequestId));
}

export async function submitBonusRequest(companyId: string, bonusRequestId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(bonusRequests).where(and(eq(bonusRequests.id, bonusRequestId), eq(bonusRequests.companyId, companyId))).limit(1);
    if (!row) throw new HrError('Ödül talebi bulunamadı.');
    if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError(`${row.status} durumundaki bir ödül talebi gönderilemez.`);

    const [employee] = await tx.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, row.employeeId)).limit(1);
    await startApprovalInTx(tx, companyId, 'BONUS', bonusRequestId, userId, { amount: Number(row.amount), departmentId: employee?.departmentId ?? undefined });
    await tx.update(bonusRequests).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(bonusRequests.id, bonusRequestId));
  });
}

export interface ActOnBonusStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnBonusStep(companyId: string, input: ActOnBonusStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new HrError('Onay adımı bulunamadı.');
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(eq(approvalInstances.id, step.instanceId)).limit(1);
    if (!instance || instance.documentType !== 'BONUS') throw new HrError('Bu adım bir ödül talebine ait değil.');
    const bonusRequestId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(bonusRequests).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(bonusRequests.id, bonusRequestId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(bonusRequests).set({ status: newStatus, completedAt: new Date() }).where(eq(bonusRequests.id, bonusRequestId));
  });
}
