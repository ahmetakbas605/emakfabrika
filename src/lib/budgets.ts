import 'server-only';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { budgets, budgetItems, accountingAccounts, accountingJournalLines, accountingJournals, budgetCommitments } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { AccountingError } from '@/lib/accounting';

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

// --- SATINALMA-MİMARİSİ Faz 0 (madde 34-36) — bütçe taahhüdü. budgetItems.
// plannedAmount (yukarısı) DEĞİŞMEDİ, bu YENİ bir tüketim katmanı: bir
// talep onaylandığında RESERVED, fatura kesildiğinde (Faz 2B/2C) CONSUMED,
// talep iptal olursa RELEASED. getBudgetVsActual (yukarısı) muhasebe
// fişlerinden GERÇEKLEŞENİ ölçer — bu ise HENÜZ fişleşmemiş ama TAAHHÜT
// edilmiş tutarı, ayrı bir kaygı (procurement onayı ANINDA "bu bütçe
// tükeniyor" uyarısı verebilmek için, fiş kesilene kadar beklemeden). ---

export interface CreateBudgetCommitmentInput {
  budgetItemId: string;
  sourceType: string;
  sourceId: string;
  amount: number | string;
  createdByUserId: string;
}

export async function createBudgetCommitmentInTx(tx: Tx, input: CreateBudgetCommitmentInput): Promise<string> {
  const id = newId();
  await tx.insert(budgetCommitments).values({
    id,
    budgetItemId: input.budgetItemId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    amount: toDb(input.amount),
    createdByUserId: input.createdByUserId
  });
  return id;
}

export async function createBudgetCommitment(input: CreateBudgetCommitmentInput): Promise<string> {
  return db.transaction((tx) => createBudgetCommitmentInTx(tx, input));
}

async function requireOwnedCommitment(companyId: string, commitmentId: string) {
  const [row] = await db
    .select({ id: budgetCommitments.id, status: budgetCommitments.status, companyId: budgets.companyId })
    .from(budgetCommitments)
    .innerJoin(budgetItems, eq(budgetItems.id, budgetCommitments.budgetItemId))
    .innerJoin(budgets, eq(budgets.id, budgetItems.budgetId))
    .where(eq(budgetCommitments.id, commitmentId))
    .limit(1);
  if (!row || row.companyId !== companyId) throw new AccountingError('Bütçe taahhüdü bulunamadı.');
  return row;
}

export async function releaseBudgetCommitment(companyId: string, commitmentId: string): Promise<void> {
  const row = await requireOwnedCommitment(companyId, commitmentId);
  if (row.status !== 'RESERVED') throw new AccountingError('Yalnızca ayrılmış (RESERVED) bir taahhüt serbest bırakılabilir.');
  await db.update(budgetCommitments).set({ status: 'RELEASED', releasedAt: new Date() }).where(eq(budgetCommitments.id, commitmentId));
}

export async function markBudgetCommitmentConsumed(companyId: string, commitmentId: string): Promise<void> {
  const row = await requireOwnedCommitment(companyId, commitmentId);
  if (row.status !== 'RESERVED') throw new AccountingError('Yalnızca ayrılmış (RESERVED) bir taahhüt tüketildi olarak işaretlenebilir.');
  await db.update(budgetCommitments).set({ status: 'CONSUMED' }).where(eq(budgetCommitments.id, commitmentId));
}

export interface BudgetItemAvailability {
  budgetItemId: string;
  plannedAmount: string;
  committed: string;
  available: string;
  // madde 35 — NOT_DEFINED burada dönmez (budgetItemId geçersizse zaten
  // hata fırlatılır); hiç taahhüt yoksa AVAILABLE, kısmen tüketilmiş ama
  // hâlâ yeterliyse PARTIAL, plannedAmount aşılmışsa EXCEEDED.
  status: 'AVAILABLE' | 'PARTIAL' | 'EXCEEDED';
}

export async function getBudgetItemAvailability(companyId: string, budgetItemId: string): Promise<BudgetItemAvailability> {
  const [item] = await db.select({ id: budgetItems.id, plannedAmount: budgetItems.plannedAmount, budgetId: budgetItems.budgetId }).from(budgetItems).where(eq(budgetItems.id, budgetItemId)).limit(1);
  if (!item) throw new AccountingError('Bütçe kalemi bulunamadı.');
  const [budget] = await db.select({ companyId: budgets.companyId }).from(budgets).where(eq(budgets.id, item.budgetId)).limit(1);
  if (!budget || budget.companyId !== companyId) throw new AccountingError('Bütçe kalemi bulunamadı.');

  const commitments = await db
    .select({ amount: budgetCommitments.amount })
    .from(budgetCommitments)
    .where(and(eq(budgetCommitments.budgetItemId, budgetItemId), inArray(budgetCommitments.status, ['RESERVED', 'CONSUMED'])));
  const committed = commitments.reduce((acc, c) => acc.plus(money(c.amount)), money(0));
  const planned = money(item.plannedAmount);
  const available = planned.minus(committed);

  const status: BudgetItemAvailability['status'] = available.lessThan(0) ? 'EXCEEDED' : committed.greaterThan(0) ? 'PARTIAL' : 'AVAILABLE';
  return { budgetItemId, plannedAmount: planned.toFixed(2), committed: committed.toFixed(2), available: available.toFixed(2), status };
}
