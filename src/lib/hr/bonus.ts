import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { bonusRequests, employees, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { assertNoConflict } from '@/lib/security/sod';
import { invalidateApproval } from '@/lib/security/tamper';
import { writeAuditLog } from '@/lib/security/audit';
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

export interface ReviseApprovedBonusInput {
  newAmount: number;
  reason: string;
}

// Core Security Faz 9 (rapor §09, madde 35 "Approval Tampering Protection")
// — lib/security/tamper.ts:invalidateApproval'ın GERÇEK tüketicisi. Bir
// ödül APPROVED olduktan SONRA tutarı değişirse, eski onay artık YENİ
// tutar için geçerli DEĞİLDİR: onayı invalidated=true işaretleyip talebi
// REVISION_REQUIRED'a çekiyoruz — submitBonusRequest zaten bu durumdan
// yeniden gönderime izin veriyordu (satır 60), workflow/engine.ts'e HİÇ
// dokunulmadı.
export async function reviseApprovedBonus(companyId: string, bonusRequestId: string, userId: string, input: ReviseApprovedBonusInput): Promise<void> {
  if (input.newAmount <= 0) throw new HrError('Tutar 0\'dan büyük olmalı.');

  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(bonusRequests).where(and(eq(bonusRequests.id, bonusRequestId), eq(bonusRequests.companyId, companyId))).limit(1);
    if (!row) throw new HrError('Ödül talebi bulunamadı.');
    if (row.status !== 'APPROVED') throw new HrError('Yalnızca onaylanmış bir ödül talebinin tutarı bu şekilde revize edilebilir.');

    const oldAmount = row.amount;
    await tx.update(bonusRequests).set({ amount: String(input.newAmount), status: 'REVISION_REQUIRED', completedAt: null }).where(eq(bonusRequests.id, bonusRequestId));
    await invalidateApproval(tx, companyId, 'BONUS', bonusRequestId, input.reason);
    await writeAuditLog({
      companyId, userId, action: 'UPDATE', entity: 'BONUS_REQUEST', entityId: bonusRequestId, module: 'HR', riskLevel: 'HIGH',
      changedFields: { amount: true, approvalInvalidated: true }, oldValue: { amount: oldAmount, status: 'APPROVED' }, newValue: { amount: String(input.newAmount), status: 'REVISION_REQUIRED', reason: input.reason }
    }, tx);
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

    // Core Security Faz 9 (madde 58) — bir ödül talebini oluşturan kişi
    // (createdByUserId/submittedByUserId) aynı talebi onaylayamaz. Bonus,
    // BAŞKASI adına oluşturulup onaylandığı için bu kuralın en anlamlı
    // olduğu ilk gerçek tüketici — kural şirket bazında aktif DEĞİLSE
    // (roleConflictRules'ta yoksa) assertNoConflict sessizce geçer.
    await assertNoConflict(companyId, 'BONUS', bonusRequestId, input.actingUserId);

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
