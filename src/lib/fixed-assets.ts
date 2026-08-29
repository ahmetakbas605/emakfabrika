import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { fixedAssets, depreciationRuns, accountingAccounts } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { postJournal, AccountingError } from '@/lib/accounting';

// PDF madde 32 — Demirbaş/amortisman. Yalnızca STRAIGHT_LINE (doğrusal)
// uygulanıyor bugün — parametrik enum (DEPRECIATION_METHODS) ileride başka
// yöntem eklemeye hazır, hesaplama burada yöntem bazında dallanıyor.

export interface CreateFixedAssetInput {
  name: string;
  accountingAccountId: string;
  accumDeprAccountId: string;
  deprExpAccountId: string;
  purchaseDate: string;
  purchaseCost: number | string;
  usefulLifeYears: number;
}

export async function createFixedAsset(companyId: string, input: CreateFixedAssetInput, createdByUserId: string): Promise<string> {
  const id = newId();
  await db.insert(fixedAssets).values({
    id,
    companyId,
    name: input.name,
    accountingAccountId: input.accountingAccountId,
    accumDeprAccountId: input.accumDeprAccountId,
    deprExpAccountId: input.deprExpAccountId,
    purchaseDate: input.purchaseDate,
    purchaseCost: String(input.purchaseCost),
    usefulLifeYears: input.usefulLifeYears,
    createdByUserId
  });
  return id;
}

export async function listFixedAssets(companyId: string) {
  return db
    .select({
      id: fixedAssets.id,
      name: fixedAssets.name,
      purchaseDate: fixedAssets.purchaseDate,
      purchaseCost: fixedAssets.purchaseCost,
      usefulLifeYears: fixedAssets.usefulLifeYears,
      depreciationMethod: fixedAssets.depreciationMethod,
      status: fixedAssets.status,
      accountCode: accountingAccounts.code,
      accountName: accountingAccounts.name
    })
    .from(fixedAssets)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, fixedAssets.accountingAccountId))
    .where(eq(fixedAssets.companyId, companyId));
}

function straightLineMonthlyAmount(purchaseCost: string, usefulLifeYears: number) {
  const totalMonths = usefulLifeYears * 12;
  return money(purchaseCost).dividedBy(totalMonths);
}

export async function getAccumulatedDepreciation(fixedAssetId: string): Promise<ReturnType<typeof money>> {
  const runs = await db.select({ amount: depreciationRuns.amount }).from(depreciationRuns).where(eq(depreciationRuns.fixedAssetId, fixedAssetId));
  return runs.reduce((sum, r) => sum.plus(money(r.amount)), money(0));
}

export interface RunDepreciationResult {
  amount: string;
  journalId: string;
}

// Bir ay için amortisman işler: DEBIT deprExpAccountId, CREDIT
// accumDeprAccountId. Birikmiş amortisman defter değerini (maliyet) AŞARSA
// kalan tutar kadar (son ay) kesilir — tam amorti olduktan sonra tekrar
// çalıştırılırsa 0 tutarlı fiş üretmek yerine reddedilir.
export async function runDepreciation(companyId: string, fixedAssetId: string, periodDate: string, createdByUserId: string): Promise<RunDepreciationResult> {
  const [asset] = await db
    .select({
      accountCode: accountingAccounts.code,
      purchaseCost: fixedAssets.purchaseCost,
      usefulLifeYears: fixedAssets.usefulLifeYears,
      depreciationMethod: fixedAssets.depreciationMethod,
      accumDeprAccountId: fixedAssets.accumDeprAccountId,
      deprExpAccountId: fixedAssets.deprExpAccountId,
      status: fixedAssets.status
    })
    .from(fixedAssets)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, fixedAssets.accountingAccountId))
    .where(and(eq(fixedAssets.id, fixedAssetId), eq(fixedAssets.companyId, companyId)))
    .limit(1);
  if (!asset) throw new AccountingError('Demirbaş bulunamadı.');
  if (asset.status !== 'ACTIVE') throw new AccountingError('Bu demirbaş aktif değil (elden çıkarılmış olabilir).');

  const [accumAccount, expAccount] = await Promise.all([
    db.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.id, asset.accumDeprAccountId)).limit(1),
    db.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.id, asset.deprExpAccountId)).limit(1)
  ]);
  if (!accumAccount[0] || !expAccount[0]) throw new AccountingError('Amortisman hesapları bulunamadı.');

  // ÖNCE kontrol et (postJournal geri alınamaz bir fiş üretir — bu kontrol
  // AFTER değil BEFORE yapılmalı, aksi halde "zaten işlenmiş" hatası
  // gerçekte yetim bir fiş bırakır). Gerçek bir yarış durumu (aynı anda iki
  // istek) hâlâ teorik olarak mümkün — bu ölçekte kabul edilen bir risk,
  // aşağıdaki unique index yine de İKİNCİ bir güvenlik ağı olarak duruyor.
  const [existingRun] = await db.select({ id: depreciationRuns.id }).from(depreciationRuns).where(and(eq(depreciationRuns.fixedAssetId, fixedAssetId), eq(depreciationRuns.periodDate, periodDate))).limit(1);
  if (existingRun) throw new AccountingError('Bu ay için amortisman zaten işlenmiş.');

  const alreadyAccumulated = await getAccumulatedDepreciation(fixedAssetId);
  const remaining = money(asset.purchaseCost).minus(alreadyAccumulated);
  if (remaining.lessThanOrEqualTo(0)) throw new AccountingError('Bu demirbaş tamamen amorti edilmiş — yeniden amortisman işlenemez.');

  const monthly = straightLineMonthlyAmount(asset.purchaseCost, asset.usefulLifeYears);
  const amount = monthly.greaterThan(remaining) ? remaining : monthly; // son ay: kalan tutar kadar kes

  let journal;
  try {
    journal = await postJournal({
      companyId,
      journalDate: periodDate,
      documentType: 'DEPRECIATION',
      description: `Amortisman — ${asset.accountCode} (${periodDate.slice(0, 7)})`,
      createdByUserId,
      lines: [{ accountCode: expAccount[0].code, debit: amount }, { accountCode: accumAccount[0].code, credit: amount }]
    });
  } catch (err) {
    throw err instanceof AccountingError ? err : new AccountingError('Amortisman fişi oluşturulamadı.');
  }

  try {
    await db.insert(depreciationRuns).values({ id: newId(), fixedAssetId, periodDate, amount: toDb(amount), journalId: journal.journalId, createdByUserId });
  } catch {
    // udx_depreciation_asset_period ihlali — bu ay için zaten işlenmiş.
    // Fiş zaten POSTED oldu (postJournal geri alınamaz — reverseJournal
    // gerekir), bu yüzden bu senaryo runDepreciation ÇAĞRILMADAN ÖNCE
    // UI/action katmanında (aynı ay için tekrar tıklanmasın diye) engellenmeli.
    throw new AccountingError('Bu ay için amortisman zaten işlenmiş.');
  }

  return { amount: toDb(amount), journalId: journal.journalId };
}

export async function listDepreciationRuns(fixedAssetId: string) {
  return db.select().from(depreciationRuns).where(eq(depreciationRuns.fixedAssetId, fixedAssetId)).orderBy(desc(depreciationRuns.periodDate));
}
