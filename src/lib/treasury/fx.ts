import 'server-only';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { bankAccounts, accountingJournalLines, accountingJournals } from '@/db/schema';
import { money } from '@/lib/money';
import { getLatestExchangeRate } from '@/lib/master-data/currency';

export interface FxExposureRow {
  bankAccountId: string;
  name: string;
  currency: string;
  nativeBalance: number;
  bookedTryValue: number;
  currentTryValue: number | null;
  unrealizedGainLoss: number | null;
}

// Kur riski — YABANCI PARA bakiyeli banka hesaplarının GERÇEK (defter-i
// kebirden gelen, bank_transactions'ı AYRICA toplamayan — cashflow.ts'in
// AYNI gerekçesi) native bakiyesi, BUGÜNKÜ kurla değerlenmiş TRY karşılığı
// (currentTryValue) İLE muhasebenin defter-i kebirde işlem ANINDAKİ
// kurlarla biriktirdiği TRY değeri (bookedTryValue) ARASINDAKİ FARK —
// gerçekleşmemiş (unrealized) kur kâr/zararı. currentTryValue, güncel bir
// kur BULUNAMAZSA (exchange_rates'te o para birimi için hiç kayıt yoksa)
// dürüstçe null döner — Faz 4'ün idealCycleTimeSeconds tanımsızsa
// Performance=null İLE AYNI ilke.
export async function getFxExposure(companyId: string): Promise<FxExposureRow[]> {
  const foreignAccounts = await db
    .select({ id: bankAccounts.id, name: bankAccounts.name, currency: bankAccounts.currency, accountingAccountId: bankAccounts.accountingAccountId })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.companyId, companyId), eq(bankAccounts.active, true), ne(bankAccounts.currency, 'TRY')));

  const result: FxExposureRow[] = [];
  for (const account of foreignAccounts) {
    const lines = await db
      .select({ debit: accountingJournalLines.debit, credit: accountingJournalLines.credit, baseCurrencyDebit: accountingJournalLines.baseCurrencyDebit, baseCurrencyCredit: accountingJournalLines.baseCurrencyCredit })
      .from(accountingJournalLines)
      .innerJoin(accountingJournals, and(eq(accountingJournals.id, accountingJournalLines.journalId), eq(accountingJournals.status, 'POSTED')))
      .where(eq(accountingJournalLines.accountId, account.accountingAccountId));

    let nativeBalance = money(0);
    let bookedTryValue = money(0);
    for (const line of lines) {
      nativeBalance = nativeBalance.plus(money(line.debit)).minus(money(line.credit));
      bookedTryValue = bookedTryValue.plus(money(line.baseCurrencyDebit)).minus(money(line.baseCurrencyCredit));
    }

    const latestRate = await getLatestExchangeRate(account.currency);
    const currentTryValue = latestRate ? nativeBalance.times(money(latestRate.rate)) : null;
    const unrealizedGainLoss = currentTryValue !== null ? currentTryValue.minus(bookedTryValue) : null;

    result.push({
      bankAccountId: account.id, name: account.name, currency: account.currency, nativeBalance: nativeBalance.toNumber(),
      bookedTryValue: bookedTryValue.toNumber(), currentTryValue: currentTryValue !== null ? currentTryValue.toNumber() : null,
      unrealizedGainLoss: unrealizedGainLoss !== null ? unrealizedGainLoss.toNumber() : null
    });
  }
  return result;
}
