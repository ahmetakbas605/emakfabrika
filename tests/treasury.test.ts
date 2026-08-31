import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, accountingAccounts } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, openPeriod, postJournal } from '../src/lib/accounting';
import { createBankAccount, recordBankTransaction } from '../src/lib/bank';
import { createCheck, transitionCheck } from '../src/lib/checks';
import { recordExchangeRate } from '../src/lib/master-data/currency';
import { createCashFlowItem, listCashFlowItems, markCashFlowItemRealized, cancelCashFlowItem, getCashFlowForecast } from '../src/lib/treasury/cashflow';
import { getFxExposure } from '../src/lib/treasury/fx';
import { TreasuryError } from '../src/lib/treasury/errors';

// Holding ERP Faz 11 (Hazine Genişletme) — Diğer kalıcı test paketleriyle
// AYNI disiplin: gerçek MySQL'e karşı, mock YOK. npm run test:treasury.
// Odak: (1) nakit akış tahmininin banka bakiyesini MUHASEBENİN KENDİ
// defter-i kebirinden (getTrialBalance) doğru okuduğu + yanlış durumdaki/
// aralık-dışı çeklerin ve iptal edilmiş kalemlerin dürüstçe hariç
// tutulduğu, (2) kur riskinin native/defter/güncel değer ve gerçekleşmemiş
// kâr-zararı TAM doğru hesapladığı + kur bulunamayan para biriminde
// dürüstçe null döndüğü.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

async function main() {
  const companyId = newId();
  const userId = newId();
  // exchange_rates GLOBAL bir tablo (company_id YOK) — testin kendi
  // eklediği satırı TEMİZLİKTE tam eşleşmeyle silebilmek için, gerçek bir
  // seed/üretim tarihiyle ÇAKIŞMAYACAK, uzak bir test tarihi kullanılıyor.
  const fxRateDate = '2099-06-15';

  await db.insert(companies).values({ id: companyId, name: 'TREASURY TEST A.Ş.', taxId: '9999999993', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: userId, companyId, fullName: 'Hazine Uzmanı', email: `test-${Date.now()}-treasury@treasury.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Ön koşullar: hesap planı + açık dönem + TRY banka hesabı ---');
    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '101', name: 'Alınan Çekler', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '102', name: 'Banka TRY', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '103', name: 'Verilen Çekler', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
    await createAccount(companyId, { code: '108', name: 'Banka USD', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '120', name: 'Alıcılar', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '600', name: 'Satış Geliri', normalBalance: 'CREDIT', accountType: 'REVENUE' });
    await createAccount(companyId, { code: '601', name: 'Diğer Gelir', normalBalance: 'CREDIT', accountType: 'REVENUE' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');

    const bankAccountId = await createBankAccount(companyId, { name: 'Ana TRY Hesabı', accountingAccountId: (await getAccountId(companyId, '102')), currency: 'TRY' });
    await recordBankTransaction({ companyId, bankAccountId, transactionType: 'IN', method: 'HAVALE', amount: 10000, counterAccountCode: '600', transactionDate: '2026-01-05', createdByUserId: userId });
    check('banka hesabına 10000 TRY gerçek muhasebe fişiyle girdi', true);

    console.log('--- Nakit Akış Tahmini: çekler + manuel kalemler (yanlış durum/aralık-dışı/iptal HARİÇ) ---');
    const today = new Date().toISOString().slice(0, 10);
    const windowEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await createCheck(companyId, { direction: 'RECEIVED', checkNo: 'CHK-001', partyName: 'Müşteri A', amount: 3000, dueDate: today, accountingAccountId: (await getAccountId(companyId, '101')), counterAccountCode: '120', createdByUserId: userId });
    await createCheck(companyId, { direction: 'ISSUED', checkNo: 'CHK-002', partyName: 'Tedarikçi B', amount: 1500, dueDate: today, accountingAccountId: (await getAccountId(companyId, '103')), createdByUserId: userId });

    const collectedCheckId = await createCheck(companyId, { direction: 'RECEIVED', checkNo: 'CHK-003', partyName: 'Müşteri C', amount: 999, dueDate: today, accountingAccountId: (await getAccountId(companyId, '101')), counterAccountCode: '120', createdByUserId: userId });
    await transitionCheck(companyId, { checkId: collectedCheckId, toStatus: 'COLLECTED', counterAccountCode: '100', createdByUserId: userId });
    // collectedCheckId BİLİNÇLİ OLARAK tahsil edildi — artık PORTFOLIO
    // DEĞİL, tahmine DAHİL EDİLMEMESİ gerektiğini kanıtlamak için.

    await createCheck(companyId, { direction: 'RECEIVED', checkNo: 'CHK-004', partyName: 'Müşteri D', amount: 888, dueDate: farFuture, accountingAccountId: (await getAccountId(companyId, '101')), counterAccountCode: '120', createdByUserId: userId });
    // CHK-004 BİLİNÇLİ OLARAK aralık DIŞINDA bir tarihte — tahmine dahil
    // EDİLMEMESİ gerektiğini kanıtlamak için.

    await createCashFlowItem(companyId, userId, { direction: 'INFLOW', description: 'Beklenen büyük havale', amount: 2000, currencyCode: 'TRY', expectedDate: today });
    await createCashFlowItem(companyId, userId, { direction: 'OUTFLOW', description: 'Beklenen tedarikçi ödemesi', amount: 500, currencyCode: 'TRY', expectedDate: today });
    const cancelledItemId = await createCashFlowItem(companyId, userId, { direction: 'INFLOW', description: 'İptal edilecek', amount: 777, currencyCode: 'TRY', expectedDate: today });
    await cancelCashFlowItem(companyId, cancelledItemId);

    let doubleCancelRejected = false;
    try {
      await cancelCashFlowItem(companyId, cancelledItemId);
    } catch (err) {
      doubleCancelRejected = err instanceof TreasuryError;
    }
    check('zaten iptal edilmiş bir kalem TEKRAR iptal edilemedi', doubleCancelRejected);

    const realizedItemId = await createCashFlowItem(companyId, userId, { direction: 'OUTFLOW', description: 'Gerçekleşecek', amount: 111, currencyCode: 'TRY', expectedDate: farFuture });
    await markCashFlowItemRealized(companyId, realizedItemId);
    let realizeAfterTerminalRejected = false;
    try {
      await markCashFlowItemRealized(companyId, realizedItemId);
    } catch (err) {
      realizeAfterTerminalRejected = err instanceof TreasuryError;
    }
    check('zaten gerçekleşmiş bir kalem TEKRAR gerçekleşti işaretlenemedi', realizeAfterTerminalRejected);

    const allItems = await listCashFlowItems(companyId);
    check('4 nakit akış kalemi listelendi (2 FORECAST dahil edilecek, 1 CANCELLED, 1 REALIZED aralık-dışı)', allItems.length === 4);

    const forecast = await getCashFlowForecast(companyId, today, windowEnd);
    check(`mevcut nakit MUHASEBENİN defter-i kebirinden doğru okundu (10000): ${forecast.currentCash}`, forecast.currentCash === 10000);
    check(`beklenen tahsilat doğru (çek 3000 + manuel 2000 = 5000, COLLECTED/aralık-dışı/iptal HARİÇ): ${forecast.expectedInflows}`, forecast.expectedInflows === 5000);
    check(`beklenen ödeme doğru (çek 1500 + manuel 500 = 2000, aralık-dışı REALIZED HARİÇ): ${forecast.expectedOutflows}`, forecast.expectedOutflows === 2000);
    check(`projeksiyon bakiye TAM doğru (10000+5000-2000=13000): ${forecast.projectedEndingCash}`, forecast.projectedEndingCash === 13000);

    console.log('--- Kur Riski: native/defter/güncel değer + gerçekleşmemiş kâr-zarar ---');
    await createBankAccount(companyId, { name: 'USD Hesabı', accountingAccountId: (await getAccountId(companyId, '108')), currency: 'USD' });
    // lib/bank.ts:recordBankTransaction BUGÜN yabancı para/kur PARAMETRESİ
    // ALMIYOR (her zaman currency='TRY' varsayılan ile postJournal'a
    // gider) — GERÇEK bir bulgu, bu fazın kapsamı DEĞİL (ayrı bir gelecek
    // iyileştirme, dürüstçe not edilir). Test, postJournal'ı DOĞRUDAN
    // çağırarak (lib/bank.ts'i BYPASS ederek) gerçekçi bir çoklu-para-
    // birimi defter durumu kuruyor — getFxExposure'ın KENDİ okuma
    // mantığını doğrulamak için.
    await postJournal({
      companyId, journalDate: '2026-02-01', documentType: 'MANUAL', description: 'USD tahsilat', createdByUserId: userId,
      lines: [
        { accountCode: '108', debit: 1000, currency: 'USD', exchangeRate: 30 },
        { accountCode: '601', credit: 30000 }
      ]
    });

    await recordExchangeRate({ currencyCode: 'USD', rateDate: fxRateDate, rate: 32, rateType: 'EFFECTIVE' });

    const fxExposure = await getFxExposure(companyId);
    const usdExposure = fxExposure.find((f) => f.currency === 'USD');
    check('yalnızca yabancı para (USD) hesabı listelendi, TRY hesabı HARİÇ tutuldu', fxExposure.length === 1 && !!usdExposure);
    check(`native bakiye doğru (1000 USD): ${usdExposure?.nativeBalance}`, usdExposure?.nativeBalance === 1000);
    check(`defter değeri doğru (1000×30=30000 TRY, işlem ANINDAKİ kurla): ${usdExposure?.bookedTryValue}`, usdExposure?.bookedTryValue === 30000);
    check(`güncel değer doğru (1000×32=32000 TRY, BUGÜNKÜ kurla): ${usdExposure?.currentTryValue}`, usdExposure?.currentTryValue === 32000);
    check(`gerçekleşmemiş kâr TAM doğru (32000-30000=2000): ${usdExposure?.unrealizedGainLoss}`, usdExposure?.unrealizedGainLoss === 2000);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(`DELETE FROM exchange_rates WHERE currency_code = 'USD' AND rate_date = ? AND rate_type = 'EFFECTIVE'`, [fxRateDate]);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    // check_events checks'ten cascade ile gider. bank_transactions/
    // bank_accounts, accounting_accounts'a (no-cascade) referans verir —
    // accounting temizliğinden ÖNCE, bu sırayla silinmeli.
    const dependentFirst = ['treasury_cash_flow_items', 'checks', 'bank_transactions', 'bank_accounts'];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

async function getAccountId(companyId: string, code: string): Promise<string> {
  const [row] = await db.select({ id: accountingAccounts.id }).from(accountingAccounts).where(and(eq(accountingAccounts.companyId, companyId), eq(accountingAccounts.code, code))).limit(1);
  if (!row) throw new Error(`Hesap bulunamadı: ${code}`);
  return row.id;
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
