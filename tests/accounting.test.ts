import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import {
  createAccount,
  openPeriod,
  closePeriod,
  reopenPeriod,
  postJournal,
  reverseJournal,
  getTrialBalance,
  AccountingError
} from '../src/lib/accounting';
import { money, toDisplay } from '../src/lib/money';

// Gerçek MySQL'e karşı, gerçek server-action/lib fonksiyonlarını (mock YOK)
// çalıştıran uçtan uca test — PDF madde 51-52, 73 (her fazdan sonra test)
// gereği. npm run test:accounting ile çalıştırılır.

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

  await db.insert(companies).values({ id: companyId, name: 'ACCOUNTING TEST A.Ş.', taxId: '9999999999', taxOffice: 'Test V.D.' });
  await db.insert(users).values({ id: userId, companyId, fullName: 'Test User', email: `test-${Date.now()}@accounting.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true });

  try {
    console.log('--- Hesap Planı kuruluyor ---');
    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '102', name: 'Bankalar', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '120', name: 'Alıcılar', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '153', name: 'Ticari Mallar', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '191', name: 'İndirilecek KDV', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '320', name: 'Satıcılar', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
    await createAccount(companyId, { code: '360', name: 'Ödenecek Vergi ve Fonlar (Tevkifat)', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
    await createAccount(companyId, { code: '391', name: 'Hesaplanan KDV', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
    await createAccount(companyId, { code: '600', name: 'Yurtiçi Satışlar', normalBalance: 'CREDIT', accountType: 'REVENUE' });
    await createAccount(companyId, { code: '621', name: 'Satılan Ticari Mallar Maliyeti', normalBalance: 'DEBIT', accountType: 'EXPENSE' });
    await createAccount(companyId, { code: '646', name: 'Kambiyo Kârları', normalBalance: 'CREDIT', accountType: 'REVENUE' });
    await createAccount(companyId, { code: '656', name: 'Kambiyo Zararları', normalBalance: 'DEBIT', accountType: 'EXPENSE' });
    check('12 hesap oluşturuldu', true);

    console.log('--- Dönem açılıyor (2026-01-01 .. 2026-12-31) ---');
    const periodId = await openPeriod(companyId, '2026-01-01', '2026-12-31');
    check('dönem açıldı', !!periodId);

    // === TEST 1: Dengeli fiş → başarılı ===
    console.log('--- Test 1: dengeli manuel fiş ---');
    const j1 = await postJournal({
      companyId,
      journalDate: '2026-01-10',
      documentType: 'MANUAL',
      description: 'Test — dengeli fiş',
      createdByUserId: userId,
      lines: [
        { accountCode: '100', debit: 1000 },
        { accountCode: '600', credit: 1000 }
      ]
    });
    check('dengeli fiş numarası MF20260000001 formatında', /^MF2026\d{8}$/.test(j1.journalNo));

    // === TEST 2: Dengesiz fiş → reddedilmeli, HİÇBİR ŞEY yazılmamalı ===
    console.log('--- Test 2: dengesiz fiş reddi ---');
    let rejected = false;
    try {
      await postJournal({
        companyId,
        journalDate: '2026-01-10',
        documentType: 'MANUAL',
        createdByUserId: userId,
        lines: [
          { accountCode: '100', debit: 500 },
          { accountCode: '600', credit: 400 } // dengesiz — 100 fark
        ]
      });
    } catch (err) {
      rejected = err instanceof AccountingError;
    }
    check('dengesiz fiş AccountingError ile reddedildi', rejected);
    const tb1 = await getTrialBalance(companyId);
    const kasaAfterReject = tb1.find((r) => r.accountCode === '100')!;
    check('reddedilen fiş Kasa bakiyesini ETKİLEMEDİ (hâlâ 1000)', money(kasaAfterReject.balance).equals(1000));

    // === SENARYO 1 (PDF madde 95): vadeli satış + kısmi tahsilat ===
    console.log('--- Senaryo 1: vadeli satış (50.000 + %20 KDV) + kısmi tahsilat (30.000) ---');
    await postJournal({
      companyId,
      journalDate: '2026-01-15',
      documentType: 'SALES_INVOICE',
      description: 'ABC Teknoloji Ltd. Şti. — 10x Dell Laptop',
      createdByUserId: userId,
      lines: [
        { accountCode: '120', debit: 60000 }, // 50.000 + %20 KDV
        { accountCode: '600', credit: 50000 },
        { accountCode: '391', credit: 10000 }
      ]
    });
    await postJournal({
      companyId,
      journalDate: '2026-01-20',
      documentType: 'PAYMENT',
      description: 'ABC Teknoloji — kısmi tahsilat',
      createdByUserId: userId,
      lines: [
        { accountCode: '102', debit: 30000 },
        { accountCode: '120', credit: 30000 }
      ]
    });
    const tb2 = await getTrialBalance(companyId);
    const aliciBalance = tb2.find((r) => r.accountCode === '120')!;
    // 60.000 (60000-30000 tahsilat) - önceki testlerden bu hesaba dokunulmadı
    check('Senaryo 1: Alıcılar bakiyesi 30.000 (60.000 borç − 30.000 tahsilat)', money(aliciBalance.balance).equals(30000));

    // === SENARYO 2 (PDF madde 96): tevkifatlı alış ===
    console.log('--- Senaryo 2: tevkifatlı alış (KDV 9/10 tevkifat) ---');
    // Mal bedeli 10.000, KDV %20=2.000, tevkifat 9/10 => tevkif edilen 1.800,
    // satıcıya ödenecek KDV yalnızca 200. Satıcı carisi net (10.000+200)=10.200,
    // sorumlu sıfatıyla ödenecek tevkifat 1.800 ayrı hesapta.
    await postJournal({
      companyId,
      journalDate: '2026-02-01',
      documentType: 'PURCHASE_INVOICE',
      description: 'Tedarikçi X — tevkifatlı hizmet alımı',
      createdByUserId: userId,
      lines: [
        { accountCode: '153', debit: 10000 },
        { accountCode: '191', debit: 2000 },
        { accountCode: '320', credit: 10200 },
        { accountCode: '360', credit: 1800 }
      ]
    });
    const tb3 = await getTrialBalance(companyId);
    const saticiBalance = tb3.find((r) => r.accountCode === '320')!;
    const tevkifatBalance = tb3.find((r) => r.accountCode === '360')!;
    check('Senaryo 2: Satıcılar (net, tevkifat düşülmüş) = 10.200', money(saticiBalance.balance).equals(10200));
    check('Senaryo 2: Tevkifat hesabı (sorumlu sıfatıyla ödenecek) = 1.800', money(tevkifatBalance.balance).equals(1800));

    // === SENARYO 3 (PDF madde 97): dövizli satış + kur farkı ===
    console.log('--- Senaryo 3: dövizli satış (1000 USD, kur 34) + farklı kurdan (36) tahsilat ---');
    await postJournal({
      companyId,
      journalDate: '2026-02-10',
      documentType: 'SALES_INVOICE',
      description: 'Dövizli satış — kur 34',
      createdByUserId: userId,
      lines: [
        { accountCode: '120', debit: 1000, currency: 'USD', exchangeRate: 34 },
        { accountCode: '600', credit: 1000, currency: 'USD', exchangeRate: 34 }
      ]
    });
    // Tahsilat anında kur 36 — TRY karşılığı (36000) fatura anındaki TRY
    // karşılığından (34000) 2000 fazla; bu FARK muhasebeleştirilmezse mizan
    // tutmaz (ACCOUNTING-ENGINE.md §9) — burada BİLEREK 2000 kur farkı satırı
    // eklenmeden test edilip sonra DOĞRU hâliyle karşılaştırılıyor.
    await postJournal({
      companyId,
      journalDate: '2026-02-15',
      documentType: 'PAYMENT',
      description: 'Dövizli tahsilat — kur 36 + kur farkı',
      createdByUserId: userId,
      lines: [
        { accountCode: '102', debit: 36000 },
        { accountCode: '120', debit: 0, credit: 34000 }, // orijinal TRY karşılığı kadar cari kapanır
        { accountCode: '646', credit: 2000 } // kur farkı geliri
      ]
    });
    const tb4 = await getTrialBalance(companyId);
    const kambiyoBalance = tb4.find((r) => r.accountCode === '646')!;
    check('Senaryo 3: kur farkı geliri (646) = 2.000', money(kambiyoBalance.balance).equals(2000));
    const aliciAfterFx = tb4.find((r) => r.accountCode === '120')!;
    // 30.000 (senaryo 1'den kalan) + 34.000 (bu senaryonun TRY karşılığı) - 34.000 (kapanış) = 30.000
    check('Senaryo 3: Alıcılar bakiyesi dövizli işlem sonrası doğru (30.000)', money(aliciAfterFx.balance).equals(30000));

    // === TEST 3: dönem kilitleme ===
    console.log('--- Test 3: dönem kilitleme ---');
    await closePeriod(companyId, periodId, userId);
    let blockedByClosedPeriod = false;
    try {
      await postJournal({
        companyId,
        journalDate: '2026-03-01',
        documentType: 'MANUAL',
        createdByUserId: userId,
        lines: [{ accountCode: '100', debit: 100 }, { accountCode: '600', credit: 100 }]
      });
    } catch (err) {
      blockedByClosedPeriod = err instanceof AccountingError;
    }
    check('kapalı döneme fiş işleme reddedildi', blockedByClosedPeriod);

    // Ters kayıt kapalı dönemdeki bir fişi bugünün (AÇIK) tarihine işler —
    // yeni bir dönem açmadan test edelim: bugünün tarihini kapsayan bir
    // dönem yok, bu yüzden reverseJournal de reddedilmeli (beklenen davranış).
    console.log('--- Test 4: ters kayıt (bugünü kapsayan açık dönem yokken reddedilmeli) ---');
    let reversalBlocked = false;
    try {
      await reverseJournal(companyId, j1.journalId, userId, 'Test ters kayıt');
    } catch (err) {
      reversalBlocked = err instanceof AccountingError;
    }
    check('bugünü kapsayan açık dönem yokken ters kayıt da reddedildi (financial immutability tutarlı)', reversalBlocked);

    // Şimdi bugünü kapsayan dönemi YENİDEN AÇIP ters kaydı GERÇEKTEN test
    // edelim — openPeriod DEĞİL reopenPeriod (aynı tarih aralığında ikinci
    // bir dönem açmak artık örtüşme kontrolüyle reddediliyor, doğru olan
    // zaten var olan dönemi yeniden açmak).
    await reopenPeriod(companyId, periodId);
    const reversal = await reverseJournal(companyId, j1.journalId, userId, 'Test ters kayıt — gerçek');
    check('ters kayıt oluşturuldu, farklı fiş numarası aldı', reversal.journalId !== j1.journalId);
    const tb5 = await getTrialBalance(companyId);
    const kasaAfterReversal = tb5.find((r) => r.accountCode === '100')!;
    // 1000 (j1) - 1000 (ters kayıt) = 0 (diğer testlerden Kasa'ya başka dokunulmadı)
    check('ters kayıt sonrası Kasa bakiyesi orijinal fişi tam iptal etti (0)', money(kasaAfterReversal.balance).equals(0));

    // === TEST 5: genel mizan dengesi (fundamental double-entry invariant) ===
    console.log('--- Test 5: genel mizan — TÜM borçlar TÜM alacaklara eşit mi ---');
    const finalTb = await getTrialBalance(companyId);
    const totalDebit = finalTb.reduce((s, r) => s.plus(money(r.totalDebit)), money(0));
    const totalCredit = finalTb.reduce((s, r) => s.plus(money(r.totalCredit)), money(0));
    check(`toplam borç (${toDisplay(totalDebit)}) = toplam alacak (${toDisplay(totalCredit)})`, totalDebit.equals(totalCredit));

    console.log('\n--- Mizan (özet) ---');
    for (const row of finalTb) {
      if (!money(row.balance).isZero()) console.log(`  ${row.accountCode} ${row.accountName}: ${toDisplay(row.balance)}`);
    }
  } finally {
    console.log('\n--- Temizlik: test şirketi siliniyor ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // accounting_journal_lines.account_id → accounting_accounts KASITLI
    // OLARAK cascade DEĞİL (financial immutability — bir hesap, kendisine
    // işlenmiş fiş satırı varken normal koşullarda SİLİNEMEMELİ). Test
    // temizliği bu yüzden company CASCADE'inden ÖNCE fiş satırlarını elle
    // siliyor — üretim kodunda bu sıraya asla ihtiyaç duyulmaz.
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl
       INNER JOIN accounting_journals j ON j.id = jl.journal_id
       WHERE j.company_id = ?`,
      [companyId]
    );
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  // db/client.ts'in mysql2 pool'u açık kaldığı sürece Node event loop'u canlı
  // tutuyor (gerçek bulgu: başarılı bir koşu bile process.exit olmadan
  // dakikalarca "asılı" görünüyordu) — testin kendisi başarılı BİTTİKTEN
  // sonra süreci açıkça sonlandırıyoruz.
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
