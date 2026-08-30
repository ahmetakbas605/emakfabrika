import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { holdings, companies } from '@/db/schema';
import { newId } from '@/lib/id';
import { CoreError } from '@/lib/core/errors';
import { getTrialBalance, type TrialBalanceRow } from '@/lib/accounting';
import { money, sum } from '@/lib/money';
import { ACCOUNT_TYPES } from '@/db/schema';

// Holding ERP Faz 0 (MASTER-ERP-ROADMAP.md, ASSUMPTIONS.md §1) — bu dosya
// yalnızca HOLDİNG SEVİYESİNDE gruplama + salt-okunur konsolidasyon sağlar.
// Muhasebe fişleri/hesap planı company-scope'lu KALIYOR (ASSUMPTIONS.md
// §1.3'ün kararı) — burada hiçbir yazma işlemi hesap planına dokunmaz.

export interface CreateHoldingInput {
  name: string;
}

export async function createHolding(input: CreateHoldingInput): Promise<string> {
  const id = newId();
  await db.insert(holdings).values({ id, name: input.name });
  return id;
}

export async function listHoldings() {
  return db.select().from(holdings);
}

export async function getHolding(holdingId: string) {
  const [row] = await db.select().from(holdings).where(eq(holdings.id, holdingId)).limit(1);
  return row ?? null;
}

export async function listHoldingCompanies(holdingId: string) {
  return db.select().from(companies).where(eq(companies.holdingId, holdingId));
}

// Bir şirketi bu holding'e taşır — companies tablosunun TEK sahibi bu
// fonksiyon değil (Faz 0 kapsamı dışında zaten var olan bir company CRUD'u
// yok, şirketler bugüne kadar yalnızca seed/migrate ile oluşuyordu — bu
// fonksiyon yalnızca holding ATAMASINI değiştirir).
export async function moveCompanyToHolding(companyId: string, holdingId: string): Promise<void> {
  const [holding] = await db.select({ id: holdings.id }).from(holdings).where(eq(holdings.id, holdingId)).limit(1);
  if (!holding) throw new CoreError('Holding bulunamadı.');
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) throw new CoreError('Şirket bulunamadı.');
  await db.update(companies).set({ holdingId }).where(eq(companies.id, companyId));
}

export interface ConsolidatedCompanySummary {
  companyId: string;
  companyName: string;
  totalsByType: Record<(typeof ACCOUNT_TYPES)[number], { totalDebit: string; totalCredit: string; balance: string }>;
}

export interface ConsolidatedSummary {
  holdingId: string;
  holdingName: string;
  companies: ConsolidatedCompanySummary[];
  holdingTotalsByType: Record<(typeof ACCOUNT_TYPES)[number], { totalDebit: string; totalCredit: string; balance: string }>;
}

// madde 31 (Holding Yönetimi — Konsolidasyon) + TENANT-ARCHITECTURE.md §2'nin
// HOLDING_ACCOUNT_PLAN_SCOPE kararı (ASSUMPTIONS.md §1.3): her şirket KENDİ
// hesap planını/mizanını üretir (getTrialBalance zaten company-scope'lu,
// DEĞİŞTİRİLMEDİ) — burada yapılan TEK şey, o mizanları accountType bazında
// (hesap KODU bazında DEĞİL — şirketler arası kod standardizasyonu garanti
// değil) toplayıp holding-geneli bir özet üretmek. Bu GERÇEK bir muhasebe
// fişi/hesap birleştirmesi DEĞİL, salt-okunur bir agregasyon raporu.
export async function getConsolidatedSummary(holdingId: string): Promise<ConsolidatedSummary> {
  const holding = await getHolding(holdingId);
  if (!holding) throw new CoreError('Holding bulunamadı.');
  const holdingCompanies = await listHoldingCompanies(holdingId);

  const emptyTotals = () =>
    Object.fromEntries(ACCOUNT_TYPES.map((t) => [t, { totalDebit: '0.00', totalCredit: '0.00', balance: '0.00' }])) as ConsolidatedSummary['holdingTotalsByType'];

  const companySummaries: ConsolidatedCompanySummary[] = [];
  const holdingAccumulator: Record<string, { debit: ReturnType<typeof money>[]; credit: ReturnType<typeof money>[]; balance: ReturnType<typeof money>[] }> = Object.fromEntries(
    ACCOUNT_TYPES.map((t) => [t, { debit: [], credit: [], balance: [] }])
  );

  for (const company of holdingCompanies) {
    const trialBalance = await getTrialBalance(company.id);
    const totalsByType = emptyTotals();
    for (const type of ACCOUNT_TYPES) {
      const rows: TrialBalanceRow[] = trialBalance.filter((r) => r.accountType === type);
      const totalDebit = sum(rows.map((r) => r.totalDebit));
      const totalCredit = sum(rows.map((r) => r.totalCredit));
      const balance = sum(rows.map((r) => r.balance));
      totalsByType[type] = { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), balance: balance.toFixed(2) };
      holdingAccumulator[type].debit.push(totalDebit);
      holdingAccumulator[type].credit.push(totalCredit);
      holdingAccumulator[type].balance.push(balance);
    }
    companySummaries.push({ companyId: company.id, companyName: company.name, totalsByType });
  }

  const holdingTotalsByType = emptyTotals();
  for (const type of ACCOUNT_TYPES) {
    holdingTotalsByType[type] = {
      totalDebit: sum(holdingAccumulator[type].debit).toFixed(2),
      totalCredit: sum(holdingAccumulator[type].credit).toFixed(2),
      balance: sum(holdingAccumulator[type].balance).toFixed(2)
    };
  }

  return { holdingId, holdingName: holding.name, companies: companySummaries, holdingTotalsByType };
}
