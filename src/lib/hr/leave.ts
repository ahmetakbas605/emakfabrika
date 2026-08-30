import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { leaveRequests, leaveEntitlements, employees, approvalSteps, approvalInstances, LEAVE_TYPES } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money } from '@/lib/money';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { HrError } from './errors';

// İK Faz 3 (İK Mimarisi raporu §09 Faz 3) — documentType='LEAVE'.
// submitLeaveRequest/actOnLeaveStep, Satınalma'nın submitAward/
// actOnAwardStep'i İLE BİREBİR AYNI desen (workflow/engine.ts SIFIR
// değişti). Tek fark: Award'ın aksine burada onay-sonrası bir downstream
// belge üretimi (PO gibi) YOK — yalnızca status geçişi.

export interface CreateLeaveRequestInput {
  leaveType: (typeof LEAVE_TYPES)[number];
  startDate: string;
  endDate: string;
  reason?: string;
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return days;
}

export async function createLeaveRequest(companyId: string, employeeId: string, createdByUserId: string, input: CreateLeaveRequestInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  const dayCount = inclusiveDayCount(input.startDate, input.endDate);
  if (dayCount <= 0) throw new HrError('Bitiş tarihi başlangıç tarihinden önce olamaz.');

  return db.transaction(async (tx) => {
    const id = newId();
    const leaveNo = await nextDocumentNo(tx, companyId, 'LEAVE', 'LV', new Date().getFullYear(), 6);
    await tx.insert(leaveRequests).values({
      id, companyId, leaveNo, employeeId, leaveType: input.leaveType, startDate: input.startDate, endDate: input.endDate,
      dayCount: String(dayCount), reason: input.reason, createdByUserId
    });
    return id;
  });
}

export async function listLeaveRequests(companyId: string, employeeId?: string) {
  const conditions = employeeId ? and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.employeeId, employeeId)) : eq(leaveRequests.companyId, companyId);
  return db
    .select({
      id: leaveRequests.id, leaveNo: leaveRequests.leaveNo, employeeId: leaveRequests.employeeId,
      employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      leaveType: leaveRequests.leaveType, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
      dayCount: leaveRequests.dayCount, status: leaveRequests.status, createdAt: leaveRequests.createdAt
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(conditions)
    .orderBy(desc(leaveRequests.createdAt));
}

export async function getLeaveRequest(companyId: string, leaveRequestId: string) {
  const [row] = await db.select().from(leaveRequests).where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.companyId, companyId))).limit(1);
  if (!row) throw new HrError('İzin talebi bulunamadı.');
  return row;
}

export async function cancelLeaveRequest(companyId: string, leaveRequestId: string, userId: string): Promise<void> {
  const [row] = await db.select().from(leaveRequests).where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.companyId, companyId))).limit(1);
  if (!row) throw new HrError('İzin talebi bulunamadı.');
  if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError('Yalnızca taslak veya değişiklik bekleyen bir izin talebi iptal edilebilir.');
  if (row.createdByUserId !== userId) throw new HrError('Yalnızca talebi oluşturan kişi iptal edebilir.');
  await db.update(leaveRequests).set({ status: 'CANCELLED' }).where(eq(leaveRequests.id, leaveRequestId));
}

// madde 33/199 ilkesi — hak ediş yasal/kıdem hesabı YOK, İK doğrudan girer.
export async function setLeaveEntitlement(companyId: string, employeeId: string, year: number, leaveType: (typeof LEAVE_TYPES)[number], entitlementDays: number): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  await db
    .insert(leaveEntitlements)
    .values({ id: newId(), companyId, employeeId, year, leaveType, entitlementDays: String(entitlementDays) })
    .onDuplicateKeyUpdate({ set: { entitlementDays: String(entitlementDays) } });
}

export interface LeaveBalance {
  leaveType: (typeof LEAVE_TYPES)[number];
  entitlementDays: number;
  usedDays: number;
  remainingDays: number;
}

// Kullanılan gün = o yıl başlangıcı düşen, APPROVED durumundaki taleplerin
// dayCount toplamı — talebin yıl sınırını AŞTIĞI senaryo (örn. 28 Aralık-
// 3 Ocak) bu basit modelde başlangıç yılına sayılır, bilinçli bir
// basitleştirme (madde bazlı gerçek takvim bölünmesi ileri bir faz).
export async function listLeaveBalancesForEmployee(companyId: string, employeeId: string, year: number): Promise<LeaveBalance[]> {
  const entitlements = await db.select().from(leaveEntitlements).where(and(eq(leaveEntitlements.companyId, companyId), eq(leaveEntitlements.employeeId, employeeId), eq(leaveEntitlements.year, year)));
  const approved = await db.select({ leaveType: leaveRequests.leaveType, dayCount: leaveRequests.dayCount, startDate: leaveRequests.startDate }).from(leaveRequests).where(and(eq(leaveRequests.companyId, companyId), eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.status, 'APPROVED')));

  return entitlements.map((e) => {
    const usedDays = approved
      .filter((a) => a.leaveType === e.leaveType && new Date(a.startDate).getFullYear() === year)
      .reduce((acc, a) => acc.plus(money(a.dayCount)), money(0));
    const entitlementMoney = money(e.entitlementDays);
    return { leaveType: e.leaveType, entitlementDays: entitlementMoney.toNumber(), usedDays: usedDays.toNumber(), remainingDays: entitlementMoney.minus(usedDays).toNumber() };
  });
}

async function getRemainingBalance(companyId: string, employeeId: string, leaveType: (typeof LEAVE_TYPES)[number], year: number): Promise<number | null> {
  const balances = await listLeaveBalancesForEmployee(companyId, employeeId, year);
  const match = balances.find((b) => b.leaveType === leaveType);
  return match ? match.remainingDays : null;
}

export async function submitLeaveRequest(companyId: string, leaveRequestId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(leaveRequests).where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.companyId, companyId))).limit(1);
    if (!row) throw new HrError('İzin talebi bulunamadı.');
    if (row.status !== 'DRAFT' && row.status !== 'REVISION_REQUIRED') throw new HrError(`${row.status} durumundaki bir izin talebi gönderilemez.`);

    // Yalnızca İK bu leaveType/yıl için bir entitlement TANIMLAMIŞSA
    // bakiye kontrolü uygulanır (SICK/UNPAID/ABSENCE gibi türlerde
    // entitlement genelde hiç tanımlanmaz — bu durumda kontrol atlanır).
    const remaining = await getRemainingBalance(companyId, row.employeeId, row.leaveType, new Date(row.startDate).getFullYear());
    if (remaining !== null && money(row.dayCount).toNumber() > remaining) {
      throw new HrError(`Yetersiz izin bakiyesi (kalan: ${remaining} gün, talep edilen: ${row.dayCount} gün).`);
    }

    const [employee] = await tx.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, row.employeeId)).limit(1);
    await startApprovalInTx(tx, companyId, 'LEAVE', leaveRequestId, userId, { departmentId: employee?.departmentId ?? undefined });
    await tx.update(leaveRequests).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(leaveRequests.id, leaveRequestId));
  });
}

export interface ActOnLeaveStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnLeaveStep(companyId: string, input: ActOnLeaveStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new HrError('Onay adımı bulunamadı.');
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(eq(approvalInstances.id, step.instanceId)).limit(1);
    if (!instance || instance.documentType !== 'LEAVE') throw new HrError('Bu adım bir izin talebine ait değil.');
    const leaveRequestId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(leaveRequests).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(leaveRequests.id, leaveRequestId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(leaveRequests).set({ status: newStatus, completedAt: new Date() }).where(eq(leaveRequests.id, leaveRequestId));
  });
}
