import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { projProgressPayments, projects, projectMilestones } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { toDb } from '@/lib/money';
import { ProjectError } from './errors';

// Hakediş (progress payment) — DRAFT→APPROVED→PAID, lib/quality/ncr.ts'nin
// KENDİ isimlendirilmiş-fiil deseniyle AYNI (jenerik bir setStatus DEĞİL,
// her aşama geçişinin kendi kuralı).

export interface CreateProgressPaymentInput {
  projectId: string;
  milestoneId?: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes?: string;
}

export async function createProgressPayment(companyId: string, createdByUserId: string, input: CreateProgressPaymentInput): Promise<string> {
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.companyId, companyId))).limit(1);
  if (!project) throw new ProjectError('Proje bulunamadı.');
  if (input.periodEnd < input.periodStart) throw new ProjectError('Dönem bitişi başlangıçtan önce olamaz.');
  if (input.milestoneId) {
    const [milestone] = await db.select({ id: projectMilestones.id }).from(projectMilestones).where(and(eq(projectMilestones.id, input.milestoneId), eq(projectMilestones.projectId, input.projectId))).limit(1);
    if (!milestone) throw new ProjectError('Milestone bu projeye ait değil.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const paymentNo = await nextDocumentNo(tx, companyId, 'PP', 'HKD', new Date().getFullYear(), 6);
    await tx.insert(projProgressPayments).values({
      id, companyId, projectId: input.projectId, milestoneId: input.milestoneId, paymentNo, periodStart: input.periodStart, periodEnd: input.periodEnd,
      amount: toDb(input.amount), notes: input.notes, createdByUserId
    });
    return id;
  });
}

export async function listProgressPayments(companyId: string, projectId?: string) {
  const conditions = projectId ? and(eq(projProgressPayments.companyId, companyId), eq(projProgressPayments.projectId, projectId)) : eq(projProgressPayments.companyId, companyId);
  return db
    .select({
      id: projProgressPayments.id, paymentNo: projProgressPayments.paymentNo, projectId: projProgressPayments.projectId, projectName: projects.name,
      milestoneId: projProgressPayments.milestoneId, periodStart: projProgressPayments.periodStart, periodEnd: projProgressPayments.periodEnd,
      amount: projProgressPayments.amount, status: projProgressPayments.status, paymentDate: projProgressPayments.paymentDate
    })
    .from(projProgressPayments)
    .innerJoin(projects, eq(projects.id, projProgressPayments.projectId))
    .where(conditions)
    .orderBy(desc(projProgressPayments.periodEnd));
}

async function getProgressPayment(companyId: string, paymentId: string) {
  const [row] = await db.select().from(projProgressPayments).where(and(eq(projProgressPayments.id, paymentId), eq(projProgressPayments.companyId, companyId))).limit(1);
  if (!row) throw new ProjectError('Hakediş kaydı bulunamadı.');
  return row;
}

export async function approveProgressPayment(companyId: string, paymentId: string): Promise<void> {
  const payment = await getProgressPayment(companyId, paymentId);
  if (payment.status !== 'DRAFT') throw new ProjectError('Yalnızca taslak (DRAFT) bir hakediş onaylanabilir.');
  await db.update(projProgressPayments).set({ status: 'APPROVED' }).where(eq(projProgressPayments.id, paymentId));
}

export interface MarkPaidInput {
  paymentDate: string;
}

export async function markProgressPaymentPaid(companyId: string, paymentId: string, input: MarkPaidInput): Promise<void> {
  const payment = await getProgressPayment(companyId, paymentId);
  if (payment.status !== 'APPROVED') throw new ProjectError('Yalnızca onaylanmış (APPROVED) bir hakediş ödendi olarak işaretlenebilir.');
  await db.update(projProgressPayments).set({ status: 'PAID', paymentDate: input.paymentDate }).where(eq(projProgressPayments.id, paymentId));
}
