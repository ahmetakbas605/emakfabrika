import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, postJournal, openPeriod, getTrialBalance } from '../src/lib/accounting';
import { createHolding, listHoldings, getHolding, listHoldingCompanies, moveCompanyToHolding, getConsolidatedSummary } from '../src/lib/holding';
import { CoreError } from '../src/lib/core/errors';
import { money, toDisplay } from '../src/lib/money';

// Holding ERP Faz 0 — gerçek MySQL'e karşı, mock YOK. accounting.test.ts İLE
// AYNI disiplin (npm run test:holding). requireHoldingAdmin/
// requireDepartmentAccess'in kendisi (next/headers cookies() gerektirdiği
// için) burada test EDİLEMEZ — o gerçek HTTP isteği gerektirir (bu proje
// boyunca zaten Playwright ile doğrulanıyor). Bu dosya yalnızca lib/holding.ts'in
// (Next.js request bağlamından bağımsız, saf) fonksiyonlarını test eder.

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
  const companyAId = newId();
  const companyBId = newId();
  const userAId = newId();
  const userBId = newId();
  let holdingId = '';

  await db.insert(companies).values([
    { id: companyAId, name: 'HOLDING TEST A A.Ş.', taxId: '9999999991', taxOffice: 'Test V.D.' },
    { id: companyBId, name: 'HOLDING TEST B A.Ş.', taxId: '9999999992', taxOffice: 'Test V.D.' }
  ]);
  await db.insert(users).values([
    { id: userAId, companyId: companyAId, fullName: 'Test User A', email: `test-${Date.now()}-a@holding.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: userBId, companyId: companyBId, fullName: 'Test User B', email: `test-${Date.now()}-b@holding.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }
  ]);

  try {
    console.log('--- İki şirkete birer hesap planı + fiş işleniyor ---');
    for (const [companyId, userId] of [[companyAId, userAId], [companyBId, userBId]] as const) {
      await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
      await createAccount(companyId, { code: '600', name: 'Satışlar', normalBalance: 'CREDIT', accountType: 'REVENUE' });
      await openPeriod(companyId, '2026-01-01', '2026-12-31');
    }
    await postJournal({ companyId: companyAId, journalDate: '2026-01-10', documentType: 'MANUAL', createdByUserId: userAId, lines: [{ accountCode: '100', debit: 1000 }, { accountCode: '600', credit: 1000 }] });
    await postJournal({ companyId: companyBId, journalDate: '2026-01-10', documentType: 'MANUAL', createdByUserId: userBId, lines: [{ accountCode: '100', debit: 2500 }, { accountCode: '600', credit: 2500 }] });
    check('iki şirkete de bağımsız fiş işlendi', true);

    console.log('--- Holding oluşturuluyor ---');
    holdingId = await createHolding({ name: 'HOLDING TEST GRUBU A.Ş.' });
    check('holding oluşturuldu', !!holdingId);
    const holding = await getHolding(holdingId);
    check('getHolding doğru kaydı döndü', holding?.name === 'HOLDING TEST GRUBU A.Ş.');

    const allHoldings = await listHoldings();
    check('listHoldings yeni holding\'i içeriyor', allHoldings.some((h) => h.id === holdingId));

    console.log('--- İki şirket holding\'e taşınıyor ---');
    await moveCompanyToHolding(companyAId, holdingId);
    await moveCompanyToHolding(companyBId, holdingId);
    const grouped = await listHoldingCompanies(holdingId);
    check('listHoldingCompanies iki şirketi de döndü', grouped.length === 2 && grouped.some((c) => c.id === companyAId) && grouped.some((c) => c.id === companyBId));

    console.log('--- Geçersiz holding\'e taşıma reddi ---');
    let invalidHoldingRejected = false;
    try {
      await moveCompanyToHolding(companyAId, newId());
    } catch (err) {
      invalidHoldingRejected = err instanceof CoreError;
    }
    check('var olmayan holding\'e taşıma CoreError ile reddedildi', invalidHoldingRejected);

    console.log('--- Geçersiz şirket taşıma reddi ---');
    let invalidCompanyRejected = false;
    try {
      await moveCompanyToHolding(newId(), holdingId);
    } catch (err) {
      invalidCompanyRejected = err instanceof CoreError;
    }
    check('var olmayan şirket için taşıma CoreError ile reddedildi', invalidCompanyRejected);

    console.log('--- Konsolide özet doğrulanıyor ---');
    const consolidated = await getConsolidatedSummary(holdingId);
    check('konsolide özet iki şirketi de içeriyor', consolidated.companies.length === 2);

    const tbA = await getTrialBalance(companyAId);
    const tbB = await getTrialBalance(companyBId);
    const kasaA = tbA.find((r) => r.accountCode === '100')!;
    const kasaB = tbB.find((r) => r.accountCode === '100')!;
    const consolidatedAsset = consolidated.holdingTotalsByType.ASSET;
    check(
      `holding ASSET toplamı, iki şirketin Kasa bakiyesinin toplamına eşit (${toDisplay(kasaA.balance)} + ${toDisplay(kasaB.balance)} = ${toDisplay(consolidatedAsset.balance)})`,
      money(consolidatedAsset.balance).equals(money(kasaA.balance).plus(money(kasaB.balance)))
    );

    const revenueA = tbA.find((r) => r.accountCode === '600')!;
    const revenueB = tbB.find((r) => r.accountCode === '600')!;
    const consolidatedRevenue = consolidated.holdingTotalsByType.REVENUE;
    check(
      `holding REVENUE toplamı doğru (${toDisplay(consolidatedRevenue.balance)} = 1000 + 2500)`,
      money(consolidatedRevenue.balance).equals(money(revenueA.balance).plus(money(revenueB.balance)))
    );

    const companyASummary = consolidated.companies.find((c) => c.companyId === companyAId)!;
    check('şirket A\'nın kendi özeti kendi mizanıyla eşleşiyor (1000)', money(companyASummary.totalsByType.ASSET.balance).equals(1000));

    console.log('\n=== HOLDİNG KONSOLİDASYON ÖZETİ ===');
    for (const c of consolidated.companies) console.log(`  ${c.companyName}: Varlık=${toDisplay(c.totalsByType.ASSET.balance)} Gelir=${toDisplay(c.totalsByType.REVENUE.balance)}`);
    console.log(`  HOLDİNG TOPLAMI: Varlık=${toDisplay(consolidated.holdingTotalsByType.ASSET.balance)} Gelir=${toDisplay(consolidated.holdingTotalsByType.REVENUE.balance)}`);
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl
       INNER JOIN accounting_journals j ON j.id = jl.journal_id
       WHERE j.company_id IN (?, ?)`,
      [companyAId, companyBId]
    );
    await cleanupConn.query('DELETE FROM companies WHERE id IN (?, ?)', [companyAId, companyBId]);
    if (holdingId) await cleanupConn.query('DELETE FROM holdings WHERE id = ?', [holdingId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
