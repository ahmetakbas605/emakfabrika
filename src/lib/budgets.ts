import 'server-only';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets, budgetItems, accountingAccounts, accountingJournalLines, accountingJournals } from '@/db/schema';
import { newId } from '@/lib/id';
import { money } from '@/lib/money';

// PDF madde 35 — Bütçe. Bütçe kalemleri muhasebe fişi ÜRETMEZ (planlama
// verisi) — yalnızca gerçekleşenle (mizan/journal_lines) karşılaştırılır.

export interface CreateBudgetInput {
  name: string;
  periodStart: string;
  periodEnd: string;
}

export async function createBudget(companyId: string, input: CreateBudgetInput): Promise<string> {
  const id = newId();
  await db.insert(budgets).values({ id, companyId, name: input.name, periodStart: input.periodStart, periodEnd: input.periodEnd });
  return id;
}

export async function listBudgets(companyId: string) {
  return db.select().from(budgets).where(eq(budgets.companyId, companyId));
}

export interface AddBudgetItemInput {
  budgetId: string;
  accountId: string;
  costCenterId?: string;
  month?: number;
  plannedAmount: number | string;
}

export async function addBudgetItem(input: AddBudgetItemInput): Promise<string> {
  const id = newId();
  await db.insert(budgetItems).values({
    id,
    budgetId: input.budgetId,
    accountId: input.accountId,
    costCenterId: input.costCenterId,
    month: input.month,
    plannedAmount: String(input.plannedAmount)
  });
  return id;
}

export interface BudgetVsActualRow {
  accountCode: string;
  accountName: string;
  planned: string;
  actual: string;
  variance: string;
}

// Gerçekleşen tutar: bütçe döneminin başlangıç-bitişi arasındaki fiş
// satırlarının o hesaba düşen toplamı (borç-alacak normal bakiyeye göre —
// GİDER/EXPENSE hesapları için borç artış, hepsi burada basitçe
// debit-credit farkı olarak alınıyor, işaret yorumu rapor ekranında yapılıyor).
export async function getBudgetVsActual(companyId: string, budgetId: string): Promise<BudgetVsActualRow[]> {
  const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.companyId, companyId))).limit(1);
  if (!budget) return [];

  const items = await db
    .select({ accountId: budgetItems.accountId, accountCode: accountingAccounts.code, accountName: accountingAccounts.name, plannedAmount: budgetItems.plannedAmount })
    .from(budgetItems)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, budgetItems.accountId))
    .where(eq(budgetItems.budgetId, budgetId));

  const plannedByAccount = new Map<string, { code: string; name: string; planned: ReturnType<typeof money> }>();
  for (const item of items) {
    const existing = plannedByAccount.get(item.accountId);
    const amount = money(item.plannedAmount);
    plannedByAccount.set(item.accountId, { code: item.accountCode, name: item.accountName, planned: existing ? existing.planned.plus(amount) : amount });
  }

  const actualRows = await db
    .select({
      accountId: accountingAccounts.id,
      totalDebit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyDebit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyCredit}), 0)`
    })
    .from(accountingAccounts)
    .leftJoin(accountingJournalLines, eq(accountingJournalLines.accountId, accountingAccounts.id))
    .leftJoin(
      accountingJournals,
      and(
        eq(accountingJournals.id, accountingJournalLines.journalId),
        eq(accountingJournals.status, 'POSTED'),
        gte(accountingJournals.journalDate, budget.periodStart),
        lte(accountingJournals.journalDate, budget.periodEnd)
      )
    )
    .where(eq(accountingAccounts.companyId, companyId))
    .groupBy(accountingAccounts.id);

  const actualByAccount = new Map(actualRows.map((r) => [r.accountId, money(r.totalDebit).minus(money(r.totalCredit))]));

  return [...plannedByAccount.entries()].map(([accountId, { code, name, planned }]) => {
    const actual = actualByAccount.get(accountId) ?? money(0);
    return { accountCode: code, accountName: name, planned: planned.toFixed(2), actual: actual.toFixed(2), variance: planned.minus(actual).toFixed(2) };
  });
}
