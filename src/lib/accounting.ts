import 'server-only';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import {
  accountingAccounts,
  accountingPeriods,
  accountingJournals,
  accountingJournalLines,
  journalNumberCounters,
  auditLogs
} from '@/db/schema';
import { newId } from '@/lib/id';
import { money, sum, toDb, equals, type MoneyInput } from '@/lib/money';

// ACCOUNTING-ENGINE.md'nin somut uygulaması. Her fonksiyon companyId'yi
// ZORUNLU ilk parametre olarak alır (SECURITY-ARCHITECTURE.md §4 — RLS
// yerine derleme-zamanı disiplin).

export class AccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingError';
  }
}

// --- Hesap Planı (PDF madde 15) ---

export interface AccountInput {
  code: string;
  name: string;
  parentAccountId?: string | null;
  normalBalance: 'DEBIT' | 'CREDIT';
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export async function createAccount(companyId: string, input: AccountInput): Promise<string> {
  const id = newId();
  await db.insert(accountingAccounts).values({
    id,
    companyId,
    code: input.code,
    name: input.name,
    parentAccountId: input.parentAccountId ?? null,
    normalBalance: input.normalBalance,
    accountType: input.accountType
  });
  return id;
}

export async function listAccounts(companyId: string) {
  return db.select().from(accountingAccounts).where(eq(accountingAccounts.companyId, companyId));
}

async function resolveAccountId(tx: Tx, companyId: string, code: string): Promise<string> {
  const [row] = await tx
    .select({ id: accountingAccounts.id, isActive: accountingAccounts.isActive })
    .from(accountingAccounts)
    .where(and(eq(accountingAccounts.companyId, companyId), eq(accountingAccounts.code, code)))
    .limit(1);
  if (!row) throw new AccountingError(`Hesap planında "${code}" kodlu bir hesap bulunamadı.`);
  if (!row.isActive) throw new AccountingError(`"${code}" kodlu hesap pasif — kullanılamaz.`);
  return row.id;
}

// --- Dönem yönetimi (PDF madde 17) ---

// Gerçek bulgu (test sırasında yakalandı): iki örtüşen dönem (biri CLOSED,
// biri OPEN) aynı anda var olabiliyordu — requireOpenPeriod'un LIMIT 1
// sorgusu hangisini döndüreceği BELİRSİZDİ, bir testte yanlışlıkla kapalı
// olanı döndürüp geçerli bir işlemi reddetti. İki düzeltme birlikte: (1)
// burada örtüşen dönem varsa reddet, (2) requireOpenPeriod artık TÜM
// örtüşen dönemleri okuyup içlerinde AÇIK olan var mı diye bakıyor (aşağıda).
export async function openPeriod(companyId: string, periodStart: string, periodEnd: string): Promise<string> {
  const overlapping = await db
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(and(eq(accountingPeriods.companyId, companyId), lte(accountingPeriods.periodStart, periodEnd), gte(accountingPeriods.periodEnd, periodStart)))
    .limit(1);
  if (overlapping.length > 0) throw new AccountingError('Bu tarih aralığıyla örtüşen bir dönem zaten tanımlı.');

  const id = newId();
  await db.insert(accountingPeriods).values({ id, companyId, periodStart, periodEnd, status: 'OPEN' });
  return id;
}

export async function closePeriod(companyId: string, periodId: string, closedByUserId: string): Promise<void> {
  await db
    .update(accountingPeriods)
    .set({ status: 'CLOSED', closedAt: new Date(), closedByUserId })
    .where(and(eq(accountingPeriods.id, periodId), eq(accountingPeriods.companyId, companyId)));
}

export async function reopenPeriod(companyId: string, periodId: string): Promise<void> {
  await db
    .update(accountingPeriods)
    .set({ status: 'OPEN', closedAt: null, closedByUserId: null })
    .where(and(eq(accountingPeriods.id, periodId), eq(accountingPeriods.companyId, companyId)));
}

export async function listPeriods(companyId: string) {
  return db.select().from(accountingPeriods).where(eq(accountingPeriods.companyId, companyId)).orderBy(desc(accountingPeriods.periodStart));
}

// Bir tarihi kapsayan AÇIK dönem var mı — yoksa/kapalıysa yazma reddedilir
// (ACCOUNTING-ENGINE.md §5, financial immutability).
async function requireOpenPeriod(tx: Tx, companyId: string, journalDate: string): Promise<void> {
  const rows = await tx
    .select({ id: accountingPeriods.id, status: accountingPeriods.status })
    .from(accountingPeriods)
    .where(and(eq(accountingPeriods.companyId, companyId), lte(accountingPeriods.periodStart, journalDate), gte(accountingPeriods.periodEnd, journalDate)));
  if (rows.length === 0) throw new AccountingError(`${journalDate} tarihini kapsayan bir muhasebe dönemi tanımlı değil.`);
  if (!rows.some((r) => r.status === 'OPEN')) throw new AccountingError(`${journalDate} tarihi kapalı bir döneme ait — bu döneme yeni fiş işlenemez (ters kayıt/düzeltme fişi kullanın).`);
}

// PDF madde 55 — atomik, eşzamanlılık-güvenli fiş numarası. "MF" + yıl +
// 8 haneli sayaç, ör. "MF202600000001". Bu fonksiyon HER ZAMAN çağıranın
// KENDİ transaction'ı (tx) içinde çalışır — UPDATE satırı, transaction
// commit olana kadar kilitli tutar, eşzamanlı iki postJournal çağrısı bu
// satırda sıraya girer (Postgres'teki pg_advisory_xact_lock'un MySQL'deki
// satır-kilidi karşılığı — LAST_INSERT_ID() gibi belirsiz dönüş şekilli
// bir numaralandırma yerine, davranışı kesin bilinen düz UPDATE+SELECT).
async function nextJournalNo(tx: Tx, companyId: string, year: number): Promise<string> {
  await tx.insert(journalNumberCounters).values({ companyId, year, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
  await tx
    .update(journalNumberCounters)
    .set({ lastNumber: sql`${journalNumberCounters.lastNumber} + 1` })
    .where(and(eq(journalNumberCounters.companyId, companyId), eq(journalNumberCounters.year, year)));
  const [row] = await tx
    .select({ lastNumber: journalNumberCounters.lastNumber })
    .from(journalNumberCounters)
    .where(and(eq(journalNumberCounters.companyId, companyId), eq(journalNumberCounters.year, year)))
    .limit(1);
  return `MF${year}${String(row.lastNumber).padStart(8, '0')}`;
}

// --- Fiş üretimi (PDF madde 14, 16, 44, 86 — ACCOUNTING-ENGINE.md §1, §4) ---

export interface JournalLineInput {
  accountCode: string;
  debit?: MoneyInput;
  credit?: MoneyInput;
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
  exchangeRate?: MoneyInput;
  description?: string;
  costCenterId?: string;
}

export interface PostJournalInput {
  companyId: string;
  journalDate: string;
  documentType: string;
  sourceType?: string;
  sourceId?: string;
  description?: string;
  createdByUserId: string;
  lines: JournalLineInput[];
}

export interface PostedJournal {
  journalId: string;
  journalNo: string;
}

// ACCOUNTING-ENGINE.md §4: TOTAL_DEBIT==TOTAL_CREDIT commit'ten ÖNCE
// doğrulanır, eşit değilse transaction hiç commit olmaz — "dengesiz fiş
// DB'ye kaydedilmemelidir" kuralı DB constraint'i DEĞİL, uygulama garantisi.
export async function postJournal(input: PostJournalInput): Promise<PostedJournal> {
  return db.transaction((tx) => postJournalInTx(tx, input));
}

// Gerçek bulgu (Demirbaş/Amortisman'da yaşandı — bkz. lib/fixed-assets.ts):
// postJournal KENDİ transaction'ını açtığı için, "önce fiş kes, sonra
// BAŞKA bir tabloyu güncelle" deseni iki AYRI transaction'a bölünüyordu —
// ikinci adım başarısız olursa yetim bir fiş kalabilirdi. Depo modülü
// (lib/warehouse.ts) AYNI riski taşıyordu (stok miktarı + fiş TEK
// transaction'da olmalı) — bu yüzden çekirdek mantık dışa, tx PARAMETRE
// olarak alan bu fonksiyona taşındı; postJournal yalnızca ince bir sarmalayıcı.
// Çağıran modüller KENDİ db.transaction'ları İÇİNDE postJournalInTx'i
// çağırarak GERÇEK atomiklik elde edebilir.
export async function postJournalInTx(tx: Tx, input: PostJournalInput): Promise<PostedJournal> {
  if (input.lines.length === 0) throw new AccountingError('Fişte en az bir kalem olmalı.');

  {
    await requireOpenPeriod(tx, input.companyId, input.journalDate);

    const resolvedLines = await Promise.all(
      input.lines.map(async (line) => {
        const accountId = await resolveAccountId(tx, input.companyId, line.accountCode);
        const currency = line.currency ?? 'TRY';
        const exchangeRate = money(line.exchangeRate ?? 1);
        const debit = money(line.debit ?? 0);
        const credit = money(line.credit ?? 0);
        const baseCurrencyDebit = currency === 'TRY' ? debit : debit.times(exchangeRate);
        const baseCurrencyCredit = currency === 'TRY' ? credit : credit.times(exchangeRate);
        return { accountId, debit, credit, currency, exchangeRate, baseCurrencyDebit, baseCurrencyCredit, description: line.description, costCenterId: line.costCenterId };
      })
    );

    const totalDebit = sum(resolvedLines.map((l) => l.baseCurrencyDebit));
    const totalCredit = sum(resolvedLines.map((l) => l.baseCurrencyCredit));
    if (!equals(totalDebit, totalCredit)) {
      throw new AccountingError(`Fiş dengesiz: toplam borç (${totalDebit.toFixed(2)}) toplam alacaktan (${totalCredit.toFixed(2)}) farklı.`);
    }

    const year = Number(input.journalDate.slice(0, 4));
    const journalNo = await nextJournalNo(tx, input.companyId, year);
    const journalId = newId();

    await tx.insert(accountingJournals).values({
      id: journalId,
      companyId: input.companyId,
      journalNo,
      journalDate: input.journalDate,
      documentType: input.documentType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      description: input.description,
      status: 'POSTED',
      createdByUserId: input.createdByUserId
    });

    await tx.insert(accountingJournalLines).values(
      resolvedLines.map((l, i) => ({
        id: newId(),
        journalId,
        accountId: l.accountId,
        debit: toDb(l.debit),
        credit: toDb(l.credit),
        currency: l.currency,
        exchangeRate: toDb(l.exchangeRate),
        baseCurrencyDebit: toDb(l.baseCurrencyDebit),
        baseCurrencyCredit: toDb(l.baseCurrencyCredit),
        description: l.description,
        costCenterId: l.costCenterId,
        lineOrder: i
      }))
    );

    // SECURITY-ARCHITECTURE.md §7 — audit log kritik-yol, AYNI transaction.
    await tx.insert(auditLogs).values({
      id: newId(),
      companyId: input.companyId,
      userId: input.createdByUserId,
      action: 'POST_JOURNAL',
      entity: 'accounting_journals',
      entityId: journalId,
      newValue: { journalNo, documentType: input.documentType, totalDebit: totalDebit.toFixed(6) }
    });

    return { journalId, journalNo };
  }
}

// --- Ters kayıt / düzeltme (PDF madde 17, 77 — financial immutability) ---

// Kapalı bir dönemdeki fişi düzeltmek gerekirse: orijinal ASLA silinmez/
// değiştirilmez, status='REVERSED' işaretlenir; ters kayıt HER ZAMAN o anki
// AÇIK döneme (bugünün tarihiyle) işlenir — kapalı dönem yeniden açılmaz.
export async function reverseJournal(companyId: string, journalId: string, byUserId: string, reason?: string): Promise<PostedJournal> {
  return db.transaction(async (tx) => {
    const [original] = await tx.select().from(accountingJournals).where(and(eq(accountingJournals.id, journalId), eq(accountingJournals.companyId, companyId))).limit(1);
    if (!original) throw new AccountingError('Ters kaydı alınacak fiş bulunamadı.');
    if (original.status === 'REVERSED') throw new AccountingError('Bu fişin ters kaydı zaten alınmış.');

    const originalLines = await tx.select().from(accountingJournalLines).where(eq(accountingJournalLines.journalId, journalId));
    const todayIso = new Date().toISOString().slice(0, 10);
    await requireOpenPeriod(tx, companyId, todayIso);

    const year = Number(todayIso.slice(0, 4));
    const journalNo = await nextJournalNo(tx, companyId, year);
    const reversalId = newId();

    await tx.insert(accountingJournals).values({
      id: reversalId,
      companyId,
      journalNo,
      journalDate: todayIso,
      documentType: original.documentType,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      description: `Ters Kayıt — ${original.journalNo}${reason ? `: ${reason}` : ''}`,
      status: 'POSTED',
      reversalOfJournalId: original.id,
      createdByUserId: byUserId
    });

    await tx.insert(accountingJournalLines).values(
      originalLines.map((l, i) => ({
        id: newId(),
        journalId: reversalId,
        accountId: l.accountId,
        // Borç/alacak TERS ÇEVRİLİR — ters kaydın kendisi
        debit: l.credit,
        credit: l.debit,
        currency: l.currency,
        exchangeRate: l.exchangeRate,
        baseCurrencyDebit: l.baseCurrencyCredit,
        baseCurrencyCredit: l.baseCurrencyDebit,
        description: l.description,
        costCenterId: l.costCenterId,
        lineOrder: i
      }))
    );

    await tx.update(accountingJournals).set({ status: 'REVERSED' }).where(eq(accountingJournals.id, journalId));

    await tx.insert(auditLogs).values({
      id: newId(),
      companyId,
      userId: byUserId,
      action: 'REVERSE_JOURNAL',
      entity: 'accounting_journals',
      entityId: journalId,
      oldValue: { status: 'POSTED' },
      newValue: { status: 'REVERSED', reversalJournalId: reversalId }
    });

    return { journalId: reversalId, journalNo };
  });
}

// --- Yevmiye Defteri (PDF madde 18) — fiş listesi/detayı ---

export async function listJournals(companyId: string) {
  return db.select().from(accountingJournals).where(eq(accountingJournals.companyId, companyId)).orderBy(desc(accountingJournals.journalDate), desc(accountingJournals.journalNo));
}

export async function getJournalWithLines(companyId: string, journalId: string) {
  const [journal] = await db.select().from(accountingJournals).where(and(eq(accountingJournals.id, journalId), eq(accountingJournals.companyId, companyId))).limit(1);
  if (!journal) return null;
  const lines = await db
    .select({ line: accountingJournalLines, accountCode: accountingAccounts.code, accountName: accountingAccounts.name })
    .from(accountingJournalLines)
    .innerJoin(accountingAccounts, eq(accountingAccounts.id, accountingJournalLines.accountId))
    .where(eq(accountingJournalLines.journalId, journalId));
  return { journal, lines };
}

// --- Mizan (PDF madde 18) — Faz 10 (Raporlar)'da genişleyecek, burada
// Accounting Core'un kendi doğruluğunu test etmek için temel bir sorgu. ---

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export async function getTrialBalance(companyId: string): Promise<TrialBalanceRow[]> {
  const rows = await db
    .select({
      accountCode: accountingAccounts.code,
      accountName: accountingAccounts.name,
      accountType: accountingAccounts.accountType,
      normalBalance: accountingAccounts.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyDebit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyCredit}), 0)`
    })
    .from(accountingAccounts)
    .leftJoin(accountingJournalLines, eq(accountingJournalLines.accountId, accountingAccounts.id))
    .leftJoin(accountingJournals, and(eq(accountingJournals.id, accountingJournalLines.journalId), eq(accountingJournals.status, 'POSTED')))
    .where(eq(accountingAccounts.companyId, companyId))
    .groupBy(accountingAccounts.id, accountingAccounts.code, accountingAccounts.name, accountingAccounts.accountType, accountingAccounts.normalBalance);

  return rows.map((r) => {
    const debit = money(r.totalDebit);
    const credit = money(r.totalCredit);
    const balance = r.normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);
    return { accountCode: r.accountCode, accountName: r.accountName, accountType: r.accountType, totalDebit: debit.toFixed(2), totalCredit: credit.toFixed(2), balance: balance.toFixed(2) };
  });
}

// --- Bilanço / Gelir Tablosu (PDF madde 18) — mizandan türetilir, ayrı bir
// hesaplama motoru YOK (kaynağın kendi kuralı: "raporlar transaction
// tablolarını gereksiz yere taramamalı" — bu zaten TEK bir mizan sorgusunun
// üzerine kurulu, madde 87 ile tutarlı). ---

export interface FinancialStatements {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  revenue: TrialBalanceRow[];
  expense: TrialBalanceRow[];
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  totalRevenue: string;
  totalExpense: string;
  netIncome: string;
}

export async function getFinancialStatements(companyId: string): Promise<FinancialStatements> {
  const rows = await getTrialBalance(companyId);
  const nonZero = rows.filter((r) => !money(r.balance).isZero());
  const byType = (type: TrialBalanceRow['accountType']) => nonZero.filter((r) => r.accountType === type);

  const assets = byType('ASSET');
  const liabilities = byType('LIABILITY');
  const equity = byType('EQUITY');
  const revenue = byType('REVENUE');
  const expense = byType('EXPENSE');

  const totalAssets = sum(assets.map((r) => r.balance));
  const totalRevenue = sum(revenue.map((r) => r.balance));
  const totalExpense = sum(expense.map((r) => r.balance));
  const netIncome = totalRevenue.minus(totalExpense);
  // Dönem net kâr/zararı, bilançoda özkaynaklara eklenen bir kalem olarak
  // gösterilir (Kurumlar Vergisi öncesi, VUK'un "Dönem Net Kârı" satırı ile
  // AYNI mantık — vergi karşılığı burada HESAPLANMIYOR, TODO: LEGAL_REVIEW_REQUIRED,
  // bkz. MEVZUAT-MAP.md).
  const totalLiabilitiesAndEquity = sum(liabilities.map((r) => r.balance)).plus(sum(equity.map((r) => r.balance))).plus(netIncome);

  return {
    assets,
    liabilities,
    equity,
    revenue,
    expense,
    totalAssets: totalAssets.toFixed(2),
    totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
    totalRevenue: totalRevenue.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netIncome: netIncome.toFixed(2)
  };
}
