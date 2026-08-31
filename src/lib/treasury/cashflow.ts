import 'server-only';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { treasuryCashFlowItems, checks } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { getTrialBalance } from '@/lib/accounting';
import { listBankAccounts } from '@/lib/bank';
import { TreasuryError } from './errors';

export interface CreateCashFlowItemInput {
  direction: (typeof treasuryCashFlowItems.$inferInsert)['direction'];
  description: string;
  amount: number;
  currencyCode: string;
  expectedDate: string;
}

export async function createCashFlowItem(companyId: string, createdByUserId: string, input: CreateCashFlowItemInput): Promise<string> {
  const id = newId();
  await db.insert(treasuryCashFlowItems).values({
    id, companyId, direction: input.direction, description: input.description, amount: toDb(input.amount),
    currencyCode: input.currencyCode, expectedDate: input.expectedDate, createdByUserId
  });
  return id;
}

export async function listCashFlowItems(companyId: string) {
  return db.select().from(treasuryCashFlowItems).where(eq(treasuryCashFlowItems.companyId, companyId)).orderBy(treasuryCashFlowItems.expectedDate);
}

async function getCashFlowItem(companyId: string, itemId: string) {
  const [row] = await db.select().from(treasuryCashFlowItems).where(and(eq(treasuryCashFlowItems.id, itemId), eq(treasuryCashFlowItems.companyId, companyId))).limit(1);
  if (!row) throw new TreasuryError('Nakit akış kalemi bulunamadı.');
  return row;
}

async function setCashFlowItemStatus(companyId: string, itemId: string, status: (typeof treasuryCashFlowItems.$inferSelect)['status']): Promise<void> {
  const item = await getCashFlowItem(companyId, itemId);
  if (item.status !== 'FORECAST') throw new TreasuryError('Yalnızca tahmin (FORECAST) aşamasındaki bir kalemin durumu değiştirilebilir.');
  await db.update(treasuryCashFlowItems).set({ status }).where(eq(treasuryCashFlowItems.id, itemId));
}

export async function markCashFlowItemRealized(companyId: string, itemId: string): Promise<void> {
  await setCashFlowItemStatus(companyId, itemId, 'REALIZED');
}

export async function cancelCashFlowItem(companyId: string, itemId: string): Promise<void> {
  await setCashFlowItemStatus(companyId, itemId, 'CANCELLED');
}

export interface CashFlowForecast {
  fromDate: string;
  toDate: string;
  currentCash: number;
  expectedInflows: number;
  expectedOutflows: number;
  projectedEndingCash: number;
}

// madde metninin kendi notu ("mevcut basit kasa/banka/çek'in ÜZERİNE") —
// bu rapor YENİ bir muhasebe motoru KURMADI. currentCash, lib/accounting.ts
// :getTrialBalance'ın (ZATEN tek doğru kaynak) banka hesaplarının kendi
// muhasebe hesabı bakiyelerinin TOPLAMI — bank_transactions'ı BURADA AYRICA
// toplamak/senkron tutmak yerine, muhasebenin KENDİ defter-i kebirine
// güvenilir (iki kaynak, iki gerçek riski YOK). lib/bank.ts:listBankAccounts
// zaten bankAccounts+accountingAccounts JOIN'ini yapıyor, DOĞRUDAN kullanılır.
export async function getCashFlowForecast(companyId: string, fromDate: string, toDate: string): Promise<CashFlowForecast> {
  const [banks, trialBalance] = await Promise.all([listBankAccounts(companyId), getTrialBalance(companyId)]);
  const bankAccountCodes = new Set(banks.map((b) => b.accountCode));
  const currentCash = trialBalance.filter((r) => bankAccountCodes.has(r.accountCode)).reduce((acc, r) => acc.plus(money(r.balance)), money(0));

  const receivedChecks = await db
    .select({ amount: checks.amount })
    .from(checks)
    .where(and(eq(checks.companyId, companyId), eq(checks.direction, 'RECEIVED'), eq(checks.status, 'PORTFOLIO'), gte(checks.dueDate, fromDate), lte(checks.dueDate, toDate)));
  const issuedChecks = await db
    .select({ amount: checks.amount })
    .from(checks)
    .where(and(eq(checks.companyId, companyId), eq(checks.direction, 'ISSUED'), inArray(checks.status, ['DRAFTED', 'DELIVERED']), gte(checks.dueDate, fromDate), lte(checks.dueDate, toDate)));

  const manualItems = await db
    .select({ direction: treasuryCashFlowItems.direction, amount: treasuryCashFlowItems.amount })
    .from(treasuryCashFlowItems)
    .where(and(eq(treasuryCashFlowItems.companyId, companyId), eq(treasuryCashFlowItems.status, 'FORECAST'), gte(treasuryCashFlowItems.expectedDate, fromDate), lte(treasuryCashFlowItems.expectedDate, toDate)));

  let expectedInflows = receivedChecks.reduce((acc, c) => acc.plus(money(c.amount)), money(0));
  let expectedOutflows = issuedChecks.reduce((acc, c) => acc.plus(money(c.amount)), money(0));
  for (const item of manualItems) {
    if (item.direction === 'INFLOW') expectedInflows = expectedInflows.plus(money(item.amount));
    else expectedOutflows = expectedOutflows.plus(money(item.amount));
  }

  const projectedEndingCash = currentCash.plus(expectedInflows).minus(expectedOutflows);

  return {
    fromDate, toDate, currentCash: currentCash.toNumber(), expectedInflows: expectedInflows.toNumber(),
    expectedOutflows: expectedOutflows.toNumber(), projectedEndingCash: projectedEndingCash.toNumber()
  };
}
