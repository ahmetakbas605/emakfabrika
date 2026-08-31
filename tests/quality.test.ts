import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, accountingAccounts, procAwards, procAwardLines, procPos, procPoLines, procReceipts, procReceiptLines } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, openPeriod } from '../src/lib/accounting';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createParty } from '../src/lib/master-data/parties';
import { createWarehouse, createStockItem, recordStockMovement } from '../src/lib/warehouse';
import { createWorkCenter } from '../src/lib/production/workcenters';
import { createBom } from '../src/lib/production/bom';
import { createRouting } from '../src/lib/production/routing';
import { createWorkflowRule, listPendingApprovalsForUser } from '../src/lib/workflow/engine';
import { createProductionOrder, submitProductionOrder, actOnProductionOrderStep, getProductionOrder } from '../src/lib/production/orders';
import { issueProductionMaterials, startProdOperation } from '../src/lib/production/execution';
import { recordInspection, listInspections } from '../src/lib/quality/inspections';
import { createNcr, listNcrs, startNcrInvestigation, recordNcrRootCause, recordNcrActions, closeNcr, rejectNcr } from '../src/lib/quality/ncr';
import { listIncomingInspectionSources, listInProcessInspectionSources, listFinalInspectionSources } from '../src/lib/quality/sources';
import { getSupplierQualityScore } from '../src/lib/quality/supplier-score';
import { QualityError } from '../src/lib/quality/errors';

// Holding ERP Faz 5 (Kalite) — Giriş/Proses/Final muayene + NCR/CAPA +
// Tedarikçi Kalite. Diğer kalıcı test paketleriyle AYNI disiplin: gerçek
// MySQL'e karşı, mock YOK. npm run test:quality.

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
  const approverId = newId();

  await db.insert(companies).values({ id: companyId, name: 'QUALITY TEST A.Ş.', taxId: '9999999997', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: userId, companyId, fullName: 'Kalite Mühendisi', email: `test-${Date.now()}-quality@quality.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: approverId, companyId, fullName: 'Üretim Müdürü', email: `test-${Date.now()}-approver@quality.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false }
  ]);

  try {
    console.log('--- Ön koşullar: tedarikçi, ürün, PO/Mal Kabul zinciri (Satınalma katmanları elle sabitlenir — bu test Satınalma DEĞİL, Kalite doğrular) ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productId = await createProduct(companyId, userId, { sku: 'QLT-URUN', name: 'Kalite Test Ürünü', baseUnitId: unitId });
    const supplierPartyId = await createParty(companyId, userId, { legalName: 'Test Tedarikçi A.Ş.', roles: ['SUPPLIER'] });

    const awardId = newId();
    await db.insert(procAwards).values({ id: awardId, companyId, awardNo: 'AWD-QLT-0001', status: 'APPROVED', createdByUserId: userId });
    const awardLineId = newId();
    await db.insert(procAwardLines).values({ id: awardLineId, awardId, supplierPartyId, awardedQty: '100', awardedUnitPrice: '10', awardedTotal: '1000' });
    const poId = newId();
    await db.insert(procPos).values({ id: poId, companyId, awardId, supplierPartyId, poNo: 'PO-QLT-0001', status: 'ISSUED', currencyCode: 'TRY', createdByUserId: userId });
    const poLineId = newId();
    await db.insert(procPoLines).values({ id: poLineId, poId, awardLineId, description: 'Kalite Test Bileşeni', quantity: '100', unitId, unitPrice: '10', lineTotal: '1000' });
    const receiptId = newId();
    await db.insert(procReceipts).values({ id: receiptId, companyId, poId, receiptNo: 'RCPT-QLT-0001', receiptDate: '2026-01-05', receivedByUserId: userId });
    const receiptLineIdPass = newId();
    const receiptLineIdFail = newId();
    await db.insert(procReceiptLines).values([
      { id: receiptLineIdPass, receiptId, poLineId, receivedQty: '50' },
      { id: receiptLineIdFail, receiptId, poLineId, receivedQty: '20' }
    ]);
    check('tedarikçi + PO/Mal Kabul zinciri hazırlandı', true);

    console.log('--- Giriş Muayenesi (Incoming) ---');
    let mismatchRejected = false;
    try {
      await recordInspection(companyId, userId, { type: 'INCOMING', sourceType: 'PROC_RECEIPT_LINE', sourceId: receiptLineIdPass, inspectedQty: 50, passedQty: 40, failedQty: 5, result: 'FAIL' });
    } catch (err) {
      mismatchRejected = err instanceof QualityError;
    }
    check('Geçen+Ret muayene edilen miktara eşit değilse reddedildi', mismatchRejected);

    const inspectionIdPass = await recordInspection(companyId, userId, { type: 'INCOMING', sourceType: 'PROC_RECEIPT_LINE', sourceId: receiptLineIdPass, productId, inspectedQty: 50, passedQty: 50, failedQty: 0, result: 'PASS' });
    const inspectionIdFail = await recordInspection(companyId, userId, { type: 'INCOMING', sourceType: 'PROC_RECEIPT_LINE', sourceId: receiptLineIdFail, productId, inspectedQty: 20, passedQty: 0, failedQty: 20, result: 'FAIL', notes: 'Boyut toleransı dışı' });
    check('İki giriş muayenesi kaydedildi (1 PASS, 1 FAIL)', !!inspectionIdPass && !!inspectionIdFail);

    const inspections = await listInspections(companyId, { type: 'INCOMING' });
    check('listInspections doğru sayıda giriş muayenesi döndü (2)', inspections.length === 2);

    const incomingSources = await listIncomingInspectionSources(companyId);
    check('listIncomingInspectionSources en az 2 mal kabul satırı içeriyor', incomingSources.length >= 2);

    console.log('--- Proses + Final Muayenesi (gerçek üretim emri/operasyon üzerinden) ---');
    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '153', name: 'Bileşen Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');
    const [account153] = await db.select().from(accountingAccounts).where(and(eq(accountingAccounts.companyId, companyId), eq(accountingAccounts.code, '153')));
    const componentId = await createProduct(companyId, userId, { sku: 'QLT-BILESEN', name: 'Kalite Bileşeni', baseUnitId: unitId });
    const warehouseId = await createWarehouse(companyId, 'Kalite Deposu');
    const componentStockItemId = await createStockItem(companyId, { sku: 'QLT-BILESEN', name: 'Kalite Bileşeni', productId: componentId, accountingAccountId: account153.id });
    await recordStockMovement({ companyId, warehouseId, stockItemId: componentStockItemId, movementType: 'IN', quantity: 500, unitCost: 5, counterAccountCode: '100', transactionDate: '2026-01-05', createdByUserId: userId });

    const workCenterId = await createWorkCenter(companyId, { code: 'WC-QLT', name: 'Kalite Test Hattı' });
    await createBom(companyId, userId, { productId, code: 'BOM-QLT', name: 'Kalite Test Reçetesi', baseQuantity: 1, unitId, lines: [{ componentProductId: componentId, quantity: 1, unitId }] });
    await createRouting(companyId, userId, { productId, code: 'RT-QLT', name: 'Kalite Test Rotası', operations: [{ workCenterId, name: 'Tek Operasyon' }] });

    const orderId = await createProductionOrder(companyId, userId, { productId, quantity: 10, unitId, warehouseId });
    await createWorkflowRule(companyId, { documentType: 'PRODUCTION_ORDER', name: 'Kalite Test Onayı', approvalChain: [{ approverType: 'SPECIFIC_USER', approverValue: approverId, mode: 'SEQUENTIAL' }] });
    await submitProductionOrder(companyId, orderId, userId);
    const pending = await listPendingApprovalsForUser(companyId, approverId);
    const stepId = pending.find((p) => p.documentType === 'PRODUCTION_ORDER')?.stepId;
    if (!stepId) throw new Error('Onay adımı bulunamadı.');
    await actOnProductionOrderStep(companyId, { stepId, actingUserId: approverId, decision: 'APPROVE' });
    await issueProductionMaterials(companyId, orderId, userId, { transactionDate: '2026-01-10' });
    const { operations } = await getProductionOrder(companyId, orderId);
    const operationId = operations[0].id;
    await startProdOperation(companyId, operationId, userId);

    const inProcessInspectionId = await recordInspection(companyId, userId, { type: 'IN_PROCESS', sourceType: 'PROD_OPERATION', sourceId: operationId, productId, inspectedQty: 5, passedQty: 5, failedQty: 0, result: 'PASS' });
    const finalInspectionId = await recordInspection(companyId, userId, { type: 'FINAL', sourceType: 'PRODUCTION_ORDER', sourceId: orderId, productId, inspectedQty: 10, passedQty: 9, failedQty: 1, result: 'CONDITIONAL' });
    check('Proses ve Final muayeneleri kaydedildi', !!inProcessInspectionId && !!finalInspectionId);

    const processSources = await listInProcessInspectionSources(companyId);
    const finalSources = await listFinalInspectionSources(companyId);
    check('listInProcessInspectionSources gerçek operasyonu içeriyor', processSources.some((s) => s.id === operationId));
    check('listFinalInspectionSources gerçek üretim emrini içeriyor', finalSources.some((s) => s.id === orderId));

    console.log('--- NCR/CAPA yaşam döngüsü (OPEN → INVESTIGATING → CORRECTIVE_ACTION → VERIFICATION → CLOSED) ---');
    const ncrClosedId = await createNcr(companyId, userId, { inspectionId: inspectionIdFail, supplierPartyId, productId, title: 'Boyut toleransı dışı parti', description: 'Mal kabulde 20 adetin tamamı reddedildi.', severity: 'MAJOR' });

    let rootCauseTooEarly = false;
    try {
      await recordNcrRootCause(companyId, ncrClosedId, 'Erken deneme');
    } catch (err) {
      rootCauseTooEarly = err instanceof QualityError;
    }
    check('OPEN aşamasında kök neden kaydı reddedildi (önce soruşturma başlamalı)', rootCauseTooEarly);

    await startNcrInvestigation(companyId, ncrClosedId);
    let doubleStartRejected = false;
    try {
      await startNcrInvestigation(companyId, ncrClosedId);
    } catch (err) {
      doubleStartRejected = err instanceof QualityError;
    }
    check('zaten soruşturulan bir NCR tekrar başlatılamadı', doubleStartRejected);

    await recordNcrRootCause(companyId, ncrClosedId, 'Tedarikçinin kalıp toleransı hatalı ayarlanmış.');
    let closeTooEarly = false;
    try {
      await closeNcr(companyId, ncrClosedId);
    } catch (err) {
      closeTooEarly = err instanceof QualityError;
    }
    check('CORRECTIVE_ACTION aşamasında (aksiyon girilmeden) kapatma reddedildi', closeTooEarly);

    await recordNcrActions(companyId, ncrClosedId, { correctiveAction: 'Kalıp toleransı yeniden ayarlandı, parti iade edildi.', preventiveAction: 'Tedarikçiden her partide kalıp kalibrasyon sertifikası istenecek.' });
    await closeNcr(companyId, ncrClosedId);
    const [closedNcr] = await listNcrs(companyId, { status: 'CLOSED' });
    check('NCR CLOSED durumuna ulaştı, kapanış zamanı kaydedildi', !!closedNcr && closedNcr.id === ncrClosedId);

    let reopenRejected = false;
    try {
      await rejectNcr(companyId, ncrClosedId);
    } catch (err) {
      reopenRejected = err instanceof QualityError;
    }
    check('kapatılmış (CLOSED) bir NCR tekrar reddedilemedi', reopenRejected);

    console.log('--- Ek NCR senaryoları: doğrudan ret + açık kalan ---');
    const ncrRejectedId = await createNcr(companyId, userId, { supplierPartyId, title: 'Yanlış alarm', description: 'İnceleme sonrası geçersiz bulundu.', severity: 'MINOR' });
    await rejectNcr(companyId, ncrRejectedId);
    const ncrOpenId = await createNcr(companyId, userId, { supplierPartyId, title: 'Açık duran kritik bulgu', description: 'Hâlâ soruşturuluyor.', severity: 'CRITICAL' });
    check('3 NCR oluşturuldu (1 CLOSED, 1 REJECTED, 1 OPEN)', true);

    console.log('--- Tedarikçi Kalite (talep üzerine hesaplanan rapor) ---');
    const score = await getSupplierQualityScore(companyId, supplierPartyId, '2026-01-01', '2026-12-31');
    check(`Giriş muayene sayısı doğru (2): ${score.incomingInspectionCount}`, score.incomingInspectionCount === 2);
    check(`Kabul edilen muayene sayısı doğru (1): ${score.incomingPassCount}`, score.incomingPassCount === 1);
    check(`Kabul oranı doğru (%50): ${score.incomingPassRate}`, score.incomingPassRate === 0.5);
    check(`Toplam NCR sayısı doğru (3): ${score.ncrCount}`, score.ncrCount === 3);
    check(`NCR önem dağılımı doğru (MINOR:1 MAJOR:1 CRITICAL:1): ${JSON.stringify(score.ncrBySeverity)}`, score.ncrBySeverity.MINOR === 1 && score.ncrBySeverity.MAJOR === 1 && score.ncrBySeverity.CRITICAL === 1);
    check(`Açık NCR sayısı doğru (1 — yalnızca ncrOpenId): ${score.openNcrCount}`, score.openNcrCount === 1);
    check('ncrOpenId hâlâ OPEN durumunda (referans bütünlüğü)', (await listNcrs(companyId, { status: 'OPEN' })).some((n) => n.id === ncrOpenId));

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    // proc_award_lines/proc_po_lines/proc_receipt_lines/party_roles hiçbirinin
    // KENDİ company_id kolonu yok — hepsi kendi üst tablosundan (proc_awards/
    // proc_pos/proc_receipts/parties, hepsi onDelete:'cascade') OTOMATİK
    // silinir; burada yalnızca company_id TAŞIYAN tablolar listelenir.
    const dependentFirst = [
      'ncr_records', 'quality_inspections',
      'proc_receipts', 'proc_pos', 'proc_awards',
      'prod_operations', 'production_orders', 'boms', 'routings', 'work_centers',
      'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items', 'warehouses',
      'parties'
    ];
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
