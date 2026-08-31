import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createContract, listContracts, updateContractStatus, listExpiringContracts } from '../src/lib/legal/contracts';
import { createLawsuit, listLawsuits, updateLawsuitStatus } from '../src/lib/legal/lawsuits';
import { createCollateral, listCollaterals, releaseCollateral } from '../src/lib/legal/collaterals';
import { createRisk, listRisks, getRisk, updateRiskAssessment, startRiskMitigation, closeRisk } from '../src/lib/legal/risks';
import { uploadAttachment, listAttachments } from '../src/lib/documents/attachments';
import { LegalError } from '../src/lib/legal/errors';

// Holding ERP Faz 9 (Hukuk + Risk Yönetimi) — Diğer kalıcı test
// paketleriyle AYNI disiplin: gerçek MySQL'e karşı, mock YOK. npm run
// test:legal. Odak: (1) sona-erme raporunun yalnızca ACTIVE+30-gün-
// içindeki sözleşmeleri yakaladığı, (2) sonuçlanmış bir davanın/serbest
// bırakılmış bir teminatın tekrar değiştirilemediği, (3) risk skorunun
// HER ZAMAN probability×impact olarak yeniden hesaplandığı (elle
// girilemediği), (4) document_attachments'ın mevcut altyapısının hiçbir
// yeni dosya-depolama kodu YAZILMADAN gerçekten çalıştığı.

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

  await db.insert(companies).values({ id: companyId, name: 'LEGAL TEST A.Ş.', taxId: '9999999996', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: userId, companyId, fullName: 'Hukuk Müşaviri', email: `test-${Date.now()}-legal@legal.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Sözleşme + belge yükleme (document_attachments\'ın gerçek ilk tüketicisi bu değil, ama entityType=\'LEGAL_CONTRACT\' ile TEKRAR kullanımı) ---');
    let invalidDateRejected = false;
    try {
      await createContract(companyId, userId, { title: 'Geçersiz Tarih', contractType: 'SERVICE', startDate: '2026-06-01', endDate: '2026-01-01' });
    } catch (err) {
      invalidDateRejected = err instanceof LegalError;
    }
    check('bitişi başlangıçtan önce olan sözleşme reddedildi', invalidDateRejected);

    const soonEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const farEnd = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const activeContractId = await createContract(companyId, userId, { title: 'Yakında Bitecek Kira Sözleşmesi', contractType: 'LEASE', startDate: '2026-01-01', endDate: soonEnd, value: 50000 });
    await updateContractStatus(companyId, activeContractId, 'ACTIVE');
    const draftContractId = await createContract(companyId, userId, { title: 'Henüz Taslak', contractType: 'SERVICE', startDate: '2026-01-01', endDate: soonEnd });
    // draftContractId BİLİNÇLİ OLARAK ACTIVE'e geçirilmedi — sona-erme
    // raporunun yalnızca ACTIVE sözleşmeleri yakaladığını kanıtlamak için.
    const farContractId = await createContract(companyId, userId, { title: 'Uzak Tarihli', contractType: 'SUPPLIER', startDate: '2026-01-01', endDate: farEnd });
    await updateContractStatus(companyId, farContractId, 'ACTIVE');

    const contracts = await listContracts(companyId);
    check('3 sözleşme listelendi', contracts.length === 3);

    const expiring = await listExpiringContracts(companyId, 30);
    check(`sona-erme raporu YALNIZCA ACTIVE+30-gün-içindeki sözleşmeyi yakaladı (1, taslak+uzak-tarihli HARİÇ): ${expiring.length}`, expiring.length === 1 && expiring[0].id === activeContractId);

    const attachmentId = await uploadAttachment(companyId, {
      entityType: 'LEGAL_CONTRACT', entityId: activeContractId, fileName: 'sozlesme.pdf', mimeType: 'application/pdf', buffer: Buffer.from('test-icerik'), uploadedByUserId: userId
    });
    const attachments = await listAttachments(companyId, 'LEGAL_CONTRACT', activeContractId);
    check('sözleşme belgesi document_attachments\'a YENİ kod yazılmadan yüklendi ve listelendi', attachments.length === 1 && attachments[0].id === attachmentId);

    console.log('--- Dava (sözleşmeye bağlı + geçersiz sözleşme reddi + sonuçlanmış davanın değişmezliği) ---');
    let missingContractRejected = false;
    try {
      await createLawsuit(companyId, userId, { title: 'Olmayan Sözleşme', companyRole: 'DEFENDANT', contractId: newId() });
    } catch (err) {
      missingContractRejected = err instanceof LegalError;
    }
    check('olmayan bir sözleşmeyle dava açılamadı', missingContractRejected);

    const lawsuitId = await createLawsuit(companyId, userId, { title: 'Kira Uyuşmazlığı', companyRole: 'DEFENDANT', contractId: activeContractId, claimAmount: 15000, courtName: 'Test Asliye Hukuk' });
    await updateLawsuitStatus(companyId, lawsuitId, 'IN_PROGRESS');
    await updateLawsuitStatus(companyId, lawsuitId, 'SETTLED');
    let terminalLawsuitChangeRejected = false;
    try {
      await updateLawsuitStatus(companyId, lawsuitId, 'IN_PROGRESS');
    } catch (err) {
      terminalLawsuitChangeRejected = err instanceof LegalError;
    }
    check('sonuçlanmış (SETTLED) bir davanın durumu tekrar DEĞİŞTİRİLEMEDİ', terminalLawsuitChangeRejected);

    const lawsuits = await listLawsuits(companyId);
    check('dava listelendi (1)', lawsuits.length === 1 && lawsuits[0].status === 'SETTLED');

    console.log('--- Teminat (sözleşmeye bağlı + geçersiz tarih reddi + serbest bırakma) ---');
    let invalidExpiryRejected = false;
    try {
      await createCollateral(companyId, userId, { contractId: activeContractId, collateralType: 'LETTER_OF_GUARANTEE', amount: 10000, issueDate: '2026-06-01', expiryDate: '2026-01-01' });
    } catch (err) {
      invalidExpiryRejected = err instanceof LegalError;
    }
    check('son kullanma düzenlemeden önce olan teminat reddedildi', invalidExpiryRejected);

    const collateralId = await createCollateral(companyId, userId, { contractId: activeContractId, collateralType: 'LETTER_OF_GUARANTEE', amount: 10000, provider: 'Test Bankası', issueDate: '2026-01-01', expiryDate: farEnd });
    await releaseCollateral(companyId, collateralId);
    let doubleReleaseRejected = false;
    try {
      await releaseCollateral(companyId, collateralId);
    } catch (err) {
      doubleReleaseRejected = err instanceof LegalError;
    }
    check('zaten serbest bırakılmış bir teminat TEKRAR serbest bırakılamadı', doubleReleaseRejected);

    const collaterals = await listCollaterals(companyId, activeContractId);
    check('teminat listelendi (1, RELEASED)', collaterals.length === 1 && collaterals[0].status === 'RELEASED');

    console.log('--- Risk Kaydı (probability×impact=score, elle GİRİLEMEZ) ---');
    let outOfRangeRejected = false;
    try {
      await createRisk(companyId, userId, { title: 'Geçersiz Olasılık', category: 'OPERATIONAL', probability: 6, impact: 3 });
    } catch (err) {
      outOfRangeRejected = err instanceof LegalError;
    }
    check('1-5 aralığı dışında olasılık reddedildi', outOfRangeRejected);

    const riskId = await createRisk(companyId, userId, { title: 'Tedarikçi İflas Riski', category: 'FINANCIAL', probability: 4, impact: 5, mitigation: 'Alternatif tedarikçi belirlenecek' });
    const riskAfterCreate = await getRisk(companyId, riskId);
    check(`skor doğru hesaplandı (4×5=20): ${riskAfterCreate.score}`, riskAfterCreate.score === 20);
    check('yeni risk OPEN durumunda başladı', riskAfterCreate.status === 'OPEN');

    await startRiskMitigation(companyId, riskId);
    check('risk MITIGATING durumuna geçti', (await getRisk(companyId, riskId)).status === 'MITIGATING');

    await updateRiskAssessment(companyId, riskId, { probability: 2, impact: 3, mitigation: 'Alternatif tedarikçi ile sözleşme imzalandı' });
    const riskAfterUpdate = await getRisk(companyId, riskId);
    check(`değerlendirme güncellenince skor YENİDEN hesaplandı (2×3=6, eski 20 DEĞİL): ${riskAfterUpdate.score}`, riskAfterUpdate.score === 6);
    check('değerlendirme güncellemesi durumu DEĞİŞTİRMEDİ (hâlâ MITIGATING)', riskAfterUpdate.status === 'MITIGATING');

    await closeRisk(companyId, riskId);
    check('risk kapatıldı', (await getRisk(companyId, riskId)).status === 'CLOSED');

    let closedUpdateRejected = false;
    try {
      await updateRiskAssessment(companyId, riskId, { probability: 1, impact: 1 });
    } catch (err) {
      closedUpdateRejected = err instanceof LegalError;
    }
    check('kapatılmış bir risk kaydı GÜNCELLENEMEDİ', closedUpdateRejected);

    let doubleCloseRejected = false;
    try {
      await closeRisk(companyId, riskId);
    } catch (err) {
      doubleCloseRejected = err instanceof LegalError;
    }
    check('zaten kapatılmış bir risk TEKRAR kapatılamadı', doubleCloseRejected);

    const risks = await listRisks(companyId);
    check('risk listelendi (1) ve en yüksek skor önce sıralanmalı (tek risk olduğu için trivially true)', risks.length === 1);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // legal_collaterals/legal_lawsuits, legal_contracts'ı referans eder
    // (cascade YOK) — legal_contracts'tan ÖNCE silinmeli. document_
    // attachments/risk_register_entries bağımsız, herhangi bir sırada olur.
    const dependentFirst = ['document_attachments', 'legal_collaterals', 'legal_lawsuits', 'legal_contracts', 'risk_register_entries'];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
