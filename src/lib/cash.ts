import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { cashAccounts, cashTransactions, accountingAccounts } from '@/db/schema';
import { newId } from '@/lib/id';
import { postJournal } from '@/lib/accounting';

// PDF madde 26 — Kasa. Her nakit hareketi, ilgili kasanın eşlendiği hesap
// planı hesabı (accountingAccountId) ile karşı hesap arasında OTOMATİK bir
// muhasebe fişi üretir (postJournal'ı doğrudan çağırır — henüz ayrı bir
// event bus yok, ACCOUNTING-ENGINE.md §1'in basitleştirilmiş hâli).

export interface CashAccountInput {
  name: string;
  accountingAccountId: string;
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
}

export async function createCashAccount(companyId: string, input: CashAccountInput): Promise<string> {
  const id = newId();
  await db.insert(cashAccounts).values({ id, companyId, name: input.name, accountingAccountId: input.accountingAccountId, currency: input.currency ?? 'TRY' });
  return id;
}

export async function listCashAccounts(companyId: string) {
  return db
    .select({ id: cashAccounts.id, name: cashAccounts.name, currency: cashAccounts.currency, active: cashAccounts.active, accountCode: accountingAccounts.code, accountName: accountingAccounts.name })
    .from(cashAccounts)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, cashAccounts.accountingAccountId))
    .where(and(eq(cashAccounts.companyId, companyId), eq(cashAccounts.active, true)));
}

export interface RecordCashTransactionInput {
  companyId: string;
  cashAccountId: string;
  transactionType: 'IN' | 'OUT';
  amount: number | string;
  counterAccountCode: string;
  description?: string;
  transactionDate: string;
  createdByUserId: string;
}

// IN (nakit girişi): kasa hesabı BORÇLANIR, karşı hesap ALACAKLANIR.
// OUT (nakit çıkışı): tam tersi.
export async function recordCashTransaction(input: RecordCashTransactionInput): Promise<string> {
  const [cashAccount] = await db
    .select({ accountingAccountId: cashAccounts.accountingAccountId, accountCode: accountingAccounts.code })
    .from(cashAccounts)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, cashAccounts.accountingAccountId))
    .where(and(eq(cashAccounts.id, input.cashAccountId), eq(cashAccounts.companyId, input.companyId)))
    .limit(1);
  if (!cashAccount) throw new Error('Kasa bulunamadı.');

  const journal = await postJournal({
    companyId: input.companyId,
    journalDate: input.transactionDate,
    documentType: 'CASH',
    description: input.description,
    createdByUserId: input.createdByUserId,
    lines:
      input.transactionType === 'IN'
        ? [{ accountCode: cashAccount.accountCode, debit: input.amount }, { accountCode: input.counterAccountCode, credit: input.amount }]
        : [{ accountCode: input.counterAccountCode, debit: input.amount }, { accountCode: cashAccount.accountCode, credit: input.amount }]
  });

  const id = newId();
  await db.insert(cashTransactions).values({
    id,
    companyId: input.companyId,
    cashAccountId: input.cashAccountId,
    transactionType: input.transactionType,
    amount: String(input.amount),
    counterAccountCode: input.counterAccountCode,
    description: input.description,
    transactionDate: input.transactionDate,
    journalId: journal.journalId,
    createdByUserId: input.createdByUserId
  });
  return id;
}

export async function listCashTransactions(companyId: string, cashAccountId?: string) {
  const conditions = cashAccountId ? and(eq(cashTransactions.companyId, companyId), eq(cashTransactions.cashAccountId, cashAccountId)) : eq(cashTransactions.companyId, companyId);
  return db.select().from(cashTransactions).where(conditions).orderBy(desc(cashTransactions.transactionDate));
}
