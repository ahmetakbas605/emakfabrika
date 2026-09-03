import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { overtimeRequests, employees, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { HrError } from './errors';

// İK Faz 3 — documentType='OVERTIME'. leave.ts'in submitLeaveRequest/
// actOnLeaveStep'i İLE BİREBİR AYNI desen, yalnızca bakiye kontrolü YOK
// (fazla mesainin bir "hakediş"i tüketmesi kavramı yok).

export interface CreateOvertimeRequestInput {
  workDate: string;
  hours: number;
  reason?: string;
}

export async function createOvertimeRequest(companyId: string, employeeId: string, createdByUserId: string, input: CreateOvertimeRequestInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  if (input.hours <= 0) throw new HrError('Saat 0\'dan büyük olmalı.');

  return db.transaction(async (tx) => {
    const id = newId();
    const overtimeNo = await nextDocumentNo(tx, companyId, 'OVERTIME', 'OT', new Date().getFullYear(), 6);
    await tx.insert(overtimeRequests).values({ id, companyId, overtimeNo, employeeId, workDate: input.workDate, hours: String(input.hours), reason: input.reason, createdByUserId });
    return id;
  });
}

export async function listOvertimeRequests(companyId: string, employeeId?: string) {
  const conditions = employeeId ? and(eq(overtimeRequests.companyId, companyId), eq(overtimeRequests.employeeId, employeeId)) : eq(overtimeRequests.companyId, companyId);
  return db
    .select({
      id: overtimeRequests.id, overtimeNo: overtimeRequests.overtimeNo, employeeId: overtimeRequests.employeeId,
      employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      workDate: overtimeRequests.workDate, hours: overtimeRequests.hours, status: overtimeRequests.status, createdAt: overtimeRequests.createdAt
    })
    .from(overtimeRequests)
    .innerJoin(employees, eq(employees.id, overtimeRequests.employeeId))
    .where(conditions)
    .orderBy(desc(overtimeRequests.createdAt));
}

export async function cancelOvertimeRequest(companyId: string, overtimeRequestId: string, userId: string): Promise<void> {
  const [row] = await db.select().from(overtimeRequests).where(and(eq(overtimeRequests.id, overtimeRequestId), eq(overtimeRequests.companyId, companyId))).limit(1);
  if (!row) throw new HrError('Fazla mesai talebi bulunamadı.');
  if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError('Yalnızca taslak veya değişiklik bekleyen bir fazla mesai talebi iptal edilebilir.');
  if (row.createdByUserId !== userId) throw new HrError('Yalnızca talebi oluşturan kişi iptal edebilir.');
  await db.update(overtimeRequests).set({ status: 'CANCELLED' }).where(eq(overtimeRequests.id, overtimeRequestId));
}

export async function submitOvertimeRequest(companyId: string, overtimeRequestId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(overtimeRequests).where(and(eq(overtimeRequests.id, overtimeRequestId), eq(overtimeRequests.companyId, companyId))).limit(1);
    if (!row) throw new HrError('Fazla mesai talebi bulunamadı.');
    if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError(`${row.status} durumundaki bir fazla mesai talebi gönderilemez.`);

    const [employee] = await tx.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, row.employeeId)).limit(1);
    await startApprovalInTx(tx, companyId, 'OVERTIME', overtimeRequestId, userId, { departmentId: employee?.departmentId ?? undefined });
    await tx.update(overtimeRequests).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(overtimeRequests.id, overtimeRequestId));
  });
}

export interface ActOnOvertimeStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnOvertimeStep(companyId: string, input: ActOnOvertimeStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new HrError('Onay adımı bulunamadı.');
    // Güvenlik denetimi 2026-09-03, bulgu 2.7 — companyId filtresi eklendi.
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
    if (!instance || instance.documentType !== 'OVERTIME') throw new HrError('Bu adım bir fazla mesai talebine ait değil.');
    const overtimeRequestId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(overtimeRequests).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(overtimeRequests.id, overtimeRequestId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(overtimeRequests).set({ status: newStatus, completedAt: new Date() }).where(eq(overtimeRequests.id, overtimeRequestId));
  });
}
