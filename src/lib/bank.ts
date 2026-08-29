import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { bankAccounts, bankTransactions, accountingAccounts } from '@/db/schema';
import { newId } from '@/lib/id';
import { postJournal } from '@/lib/accounting';

// PDF madde 27 — Banka. lib/cash.ts ile AYNI desen (kasa/banka arasında
// tek fark: banka hareketinde bir "method" — havale/EFT/FAST/kredi kartı/
// POS/komisyon — de var).

export interface BankAccountInput {
  name: string;
  iban?: string;
  accountingAccountId: string;
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
}

export async function createBankAccount(companyId: string, input: BankAccountInput): Promise<string> {
  const id = newId();
  await db.insert(bankAccounts).values({ id, companyId, name: input.name, iban: input.iban ?? '', accountingAccountId: input.accountingAccountId, currency: input.currency ?? 'TRY' });
  return id;
}

export async function listBankAccounts(companyId: string) {
  return db
    .select({ id: bankAccounts.id, name: bankAccounts.name, iban: bankAccounts.iban, currency: bankAccounts.currency, active: bankAccounts.active, accountCode: accountingAccounts.code, accountName: accountingAccounts.name })
    .from(bankAccounts)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, bankAccounts.accountingAccountId))
    .where(and(eq(bankAccounts.companyId, companyId), eq(bankAccounts.active, true)));
}

export interface RecordBankTransactionInput {
  companyId: string;
  bankAccountId: string;
  transactionType: 'IN' | 'OUT';
  method: 'HAVALE' | 'EFT' | 'FAST' | 'KREDI_KARTI' | 'POS' | 'KOMISYON' | 'DIGER';
  amount: number | string;
  counterAccountCode: string;
  description?: string;
  transactionDate: string;
  createdByUserId: string;
}

export async function recordBankTransaction(input: RecordBankTransactionInput): Promise<string> {
  const [bankAccount] = await db
    .select({ accountingAccountId: bankAccounts.accountingAccountId, accountCode: accountingAccounts.code })
    .from(bankAccounts)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, bankAccounts.accountingAccountId))
    .where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.companyId, input.companyId)))
    .limit(1);
  if (!bankAccount) throw new Error('Banka hesabı bulunamadı.');

  const journal = await postJournal({
    companyId: input.companyId,
    journalDate: input.transactionDate,
    documentType: 'BANK',
    description: input.description ? `${input.method} — ${input.description}` : input.method,
    createdByUserId: input.createdByUserId,
    lines:
      input.transactionType === 'IN'
        ? [{ accountCode: bankAccount.accountCode, debit: input.amount }, { accountCode: input.counterAccountCode, credit: input.amount }]
        : [{ accountCode: input.counterAccountCode, debit: input.amount }, { accountCode: bankAccount.accountCode, credit: input.amount }]
  });

  const id = newId();
  await db.insert(bankTransactions).values({
    id,
    companyId: input.companyId,
    bankAccountId: input.bankAccountId,
    transactionType: input.transactionType,
    method: input.method,
    amount: String(input.amount),
    counterAccountCode: input.counterAccountCode,
    description: input.description,
    transactionDate: input.transactionDate,
    journalId: journal.journalId,
    createdByUserId: input.createdByUserId
  });
  return id;
}

export async function listBankTransactions(companyId: string, bankAccountId?: string) {
  const conditions = bankAccountId ? and(eq(bankTransactions.companyId, companyId), eq(bankTransactions.bankAccountId, bankAccountId)) : eq(bankTransactions.companyId, companyId);
  return db.select().from(bankTransactions).where(conditions).orderBy(desc(bankTransactions.transactionDate));
}
