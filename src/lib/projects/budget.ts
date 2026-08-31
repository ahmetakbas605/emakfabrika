import 'server-only';
import { eq, and, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { projects, procRequests, projProgressPayments } from '@/db/schema';
import { money } from '@/lib/money';
import { ProjectError } from './errors';

// lib/mes/oee.ts + lib/quality/supplier-score.ts + lib/eam/energy.ts +
// lib/fleet/expenses.ts İLE AYNI ALTINCI uygulaması: SAKLANAN bir "kalan
// bütçe" alanı DEĞİL, projenin budgetAmount'ı + Satın Alma'nın proje-bazlı
// taleplerinin (committedAmount) + hakediş ödemelerinin (paidAmount) TALEP
// ÜZERİNE toplandığı bir rapor. Muhasebe'nin KENDİ dönemsel bütçe modelini
// (budgets/budget_items) TEKRARLAMADI — bu, farklı bir soru soruyor:
// "bu proje bütçesinde ne kadar kaldı", "bu dönemde ne kadar harcandı" değil.
const COMMITTED_EXCLUDED_STATUSES = ['DRAFT', 'REJECTED', 'CANCELLED'] as const;

export interface ProjectBudgetStatus {
  projectId: string;
  budgetAmount: number | null;
  committedAmount: number;
  paidAmount: number;
  remainingBudget: number | null;
}

export async function getProjectBudgetStatus(companyId: string, projectId: string): Promise<ProjectBudgetStatus> {
  const [project] = await db.select({ budgetAmount: projects.budgetAmount }).from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId))).limit(1);
  if (!project) throw new ProjectError('Proje bulunamadı.');

  const requests = await db
    .select({ estimatedTotal: procRequests.estimatedTotal })
    .from(procRequests)
    .where(and(eq(procRequests.companyId, companyId), eq(procRequests.projectId, projectId), notInArray(procRequests.status, [...COMMITTED_EXCLUDED_STATUSES])));
  const committedAmount = requests
    .filter((r) => r.estimatedTotal !== null)
    .reduce((acc, r) => acc.plus(money(r.estimatedTotal ?? 0)), money(0));

  const payments = await db
    .select({ amount: projProgressPayments.amount })
    .from(projProgressPayments)
    .where(and(eq(projProgressPayments.companyId, companyId), eq(projProgressPayments.projectId, projectId), eq(projProgressPayments.status, 'PAID')));
  const paidAmount = payments.reduce((acc, p) => acc.plus(money(p.amount)), money(0));

  const budgetAmount = project.budgetAmount === null ? null : money(project.budgetAmount).toNumber();
  const remainingBudget = budgetAmount === null ? null : money(budgetAmount).minus(committedAmount).minus(paidAmount).toNumber();

  return { projectId, budgetAmount, committedAmount: committedAmount.toNumber(), paidAmount: paidAmount.toNumber(), remainingBudget };
}
