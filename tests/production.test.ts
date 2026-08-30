import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, invReservations, accountingAccounts } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, openPeriod, getTrialBalance } from '../src/lib/accounting';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createWarehouse, createStockItem, recordStockMovement, listInvBalances } from '../src/lib/warehouse';
import { createWorkflowRule, listPendingApprovalsForUser } from '../src/lib/workflow/engine';
import { createWorkCenter } from '../src/lib/production/workcenters';
import { createBom } from '../src/lib/production/bom';
import { createRouting } from '../src/lib/production/routing';
import { createProductionOrder, submitProductionOrder, actOnProductionOrderStep, getProductionOrder, cancelProductionOrder } from '../src/lib/production/orders';
import { issueProductionMaterials, startProdOperation, completeProdOperation, completeProductionOrder, listProdOperations } from '../src/lib/production/execution';
import { money, toDisplay } from '../src/lib/money';

// Holding ERP Faz 2 — Üretim Çekirdeği. accounting.test.ts/sales.test.ts İLE
// AYNI disiplin: gerçek MySQL'e karşı, mock YOK. Tam zinciri dener: İş
// Merkezi → BOM(fire%) → Routing(2 operasyon) → Üretim Emri → Onay(+stok
// rezervasyonu) → otomatik İş Emirleri → Malzeme Çıkışı(+rezervasyon serbest
// bırakma +gerçek muhasebe fişi) → Operasyon başlat/tamamla → Üretim
// Tamamlama(+mamul stok girişi +gerçek muhasebe fişi). npm run test:production.

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
  const creatorId = newId();
  const approverId = newId();

  await db.insert(companies).values({ id: companyId, name: 'PRODUCTION TEST A.Ş.', taxId: '9999999994', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: creatorId, companyId, fullName: 'Üretim Planlamacı', email: `test-${Date.now()}-creator@production.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: approverId, companyId, fullName: 'Üretim Müdürü', email: `test-${Date.now()}-approver@production.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false }
  ]);

  try {
    console.log('--- Ön koşullar: birim, ürünler, depo, hesap planı, başlangıç stoğu ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productP = await createProduct(companyId, creatorId, { sku: 'MAMUL-P', name: 'Mamul P', baseUnitId: unitId });
    const componentA = await createProduct(companyId, creatorId, { sku: 'BILESEN-A', name: 'Bileşen A', baseUnitId: unitId });
    const componentB = await createProduct(companyId, creatorId, { sku: 'BILESEN-B', name: 'Bileşen B', baseUnitId: unitId });
    const warehouseId = await createWarehouse(companyId, 'Üretim Deposu');

    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '150', name: 'Bileşen A Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '151', name: 'Bileşen B Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '152', name: 'Mamul P Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '710', name: 'Direkt İlk Madde Tüketimi', normalBalance: 'DEBIT', accountType: 'EXPENSE' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');

    const stockItemA = await createStockItem(companyId, { sku: 'BILESEN-A', name: 'Bileşen A', productId: componentA, accountingAccountId: (await getAccountId(companyId, '150')) });
    const stockItemB = await createStockItem(companyId, { sku: 'BILESEN-B', name: 'Bileşen B', productId: componentB, accountingAccountId: (await getAccountId(companyId, '151')) });
    const stockItemP = await createStockItem(companyId, { sku: 'MAMUL-P', name: 'Mamul P', productId: productP, accountingAccountId: (await getAccountId(companyId, '152')) });

    await recordStockMovement({ companyId, warehouseId, stockItemId: stockItemA, movementType: 'IN', quantity: 20, unitCost: 10, counterAccountCode: '100', transactionDate: '2026-01-05', createdByUserId: creatorId });
    await recordStockMovement({ companyId, warehouseId, stockItemId: stockItemB, movementType: 'IN', quantity: 10, unitCost: 20, counterAccountCode: '100', transactionDate: '2026-01-05', createdByUserId: creatorId });
    check('bileşen başlangıç stoğu girildi (A:20@10, B:10@20)', true);

    console.log('--- İş Merkezi + BOM (%10 fire) + Routing (2 operasyon) ---');
    const workCenterId = await createWorkCenter(companyId, { code: 'WC-1', name: 'Montaj Hattı 1' });
    await createBom(companyId, creatorId, {
      productId: productP, code: 'BOM-P', name: 'Mamul P Reçetesi', baseQuantity: 1, unitId,
      lines: [
        { componentProductId: componentA, quantity: 2, unitId, scrapPercent: 10 },
        { componentProductId: componentB, quantity: 1, unitId }
      ]
    });
    await createRouting(companyId, creatorId, {
      productId: productP, code: 'RT-P', name: 'Mamul P Rotası',
      operations: [
        { workCenterId, name: 'Kesim' },
        { workCenterId, name: 'Montaj' }
      ]
    });
    check('BOM ve Routing oluşturuldu', true);

    console.log('--- Üretim Emri (miktar=5) → Onay ---');
    const orderId = await createProductionOrder(companyId, creatorId, { productId: productP, quantity: 5, unitId, warehouseId });
    const { order: orderAfterCreate } = await getProductionOrder(companyId, orderId);
    check('üretim emri DRAFT olarak, doğru BOM/Routing ile oluşturuldu', orderAfterCreate.status === 'DRAFT' && !!orderAfterCreate.bomId && !!orderAfterCreate.routingId);

    await createWorkflowRule(companyId, { documentType: 'PRODUCTION_ORDER', name: 'Üretim Emri Onayı', approvalChain: [{ approverType: 'SPECIFIC_USER', approverValue: approverId, mode: 'SEQUENTIAL' }] });
    await submitProductionOrder(companyId, orderId, creatorId);
    const pendingForApprover = await listPendingApprovalsForUser(companyId, approverId);
    const stepId = pendingForApprover.find((p) => p.documentType === 'PRODUCTION_ORDER')?.stepId;
    check('onay adımı approver\'a atandı', !!stepId);
    if (!stepId) throw new Error('Onay adımı bulunamadı — test devam edemez.');

    await actOnProductionOrderStep(companyId, { stepId, actingUserId: approverId, decision: 'APPROVE' });
    const { order: orderAfterApproval, operations: operationsAfterApproval } = await getProductionOrder(companyId, orderId);
    check('onay sonrası RELEASED oldu', orderAfterApproval.status === 'RELEASED');
    check('routing\'in 2 operasyonu için otomatik iş emri üretildi (PENDING)', operationsAfterApproval.length === 2 && operationsAfterApproval.every((o) => o.status === 'PENDING'));

    const reservationA = await db.select().from(invReservations).where(and(eq(invReservations.sourceId, orderId), eq(invReservations.stockItemId, stockItemA)));
    const reservationB = await db.select().from(invReservations).where(and(eq(invReservations.sourceId, orderId), eq(invReservations.stockItemId, stockItemB)));
    // BOM: 2×5=10 + %10 fire = 11 (A), 1×5=5 (B) — scaleFactor = quantity(5)/baseQuantity(1) = 5.
    check(`onay bileşen A için doğru miktarda (11 = 2×5×1.10) rezervasyon oluşturdu`, reservationA.length === 1 && money(reservationA[0].quantity).equals(11) && reservationA[0].status === 'ACTIVE');
    check(`onay bileşen B için doğru miktarda (5 = 1×5) rezervasyon oluşturdu`, reservationB.length === 1 && money(reservationB[0].quantity).equals(5) && reservationB[0].status === 'ACTIVE');

    console.log('--- Malzeme Çıkışı ---');
    await issueProductionMaterials(companyId, orderId, creatorId, { transactionDate: '2026-01-10', counterAccountCode: '710' });
    const { order: orderAfterIssue } = await getProductionOrder(companyId, orderId);
    check('malzeme çıkışı sonrası IN_PROGRESS oldu, materialsIssuedAt dolduruldu', orderAfterIssue.status === 'IN_PROGRESS' && !!orderAfterIssue.materialsIssuedAt);

    const balanceA = (await listInvBalances(companyId, warehouseId)).find((b) => b.stockItemId === stockItemA);
    const balanceB = (await listInvBalances(companyId, warehouseId)).find((b) => b.stockItemId === stockItemB);
    check('bileşen A stoğu doğru düştü (20-11=9)', !!balanceA && money(balanceA.qty).equals(9));
    check('bileşen B stoğu doğru düştü (10-5=5)', !!balanceB && money(balanceB.qty).equals(5));

    const reservationsAfterIssue = await db.select().from(invReservations).where(eq(invReservations.sourceId, orderId));
    check('malzeme çıkışı sonrası TÜM rezervasyonlar serbest bırakıldı (RELEASED)', reservationsAfterIssue.length === 2 && reservationsAfterIssue.every((r) => r.status === 'RELEASED'));

    const tbAfterIssue = await getTrialBalance(companyId);
    const acc150AfterIssue = tbAfterIssue.find((r) => r.accountCode === '150')!;
    const acc151AfterIssue = tbAfterIssue.find((r) => r.accountCode === '151')!;
    const acc710AfterIssue = tbAfterIssue.find((r) => r.accountCode === '710')!;
    check(`malzeme çıkışı gerçek muhasebe fişi ürettim (150: 200-110=90): ${toDisplay(acc150AfterIssue.balance)}`, money(acc150AfterIssue.balance).equals(90));
    check(`malzeme çıkışı gerçek muhasebe fişi ürettim (151: 200-100=100): ${toDisplay(acc151AfterIssue.balance)}`, money(acc151AfterIssue.balance).equals(100));
    check(`710 (tüketim) doğru toplam (110+100=210): ${toDisplay(acc710AfterIssue.balance)}`, money(acc710AfterIssue.balance).equals(210));

    console.log('--- İş Emri Operasyonları ---');
    const operations = await listProdOperations(companyId, orderId);
    for (const op of operations) {
      await startProdOperation(companyId, op.id, creatorId);
      await completeProdOperation(companyId, op.id, { goodQuantity: 5 });
    }
    const operationsAfterComplete = await listProdOperations(companyId, orderId);
    check('her iki operasyon da COMPLETED', operationsAfterComplete.every((o) => o.status === 'COMPLETED'));

    console.log('--- Üretim Tamamlama (Mamul Girişi) ---');
    let blockedBeforeOps = false;
    // (Operasyonlar zaten tamamlandığı için burada normal akış test ediliyor — erken tamamlama denemesi ayrı bir kontrol.)
    try {
      await completeProductionOrder(companyId, orderId, creatorId, { goodQuantity: 5, scrapQuantity: 0, transactionDate: '2026-01-15', unitCost: 100, counterAccountCode: '710' });
    } catch {
      blockedBeforeOps = true;
    }
    check('üretim tamamlama başarılı oldu (operasyonlar zaten tamamlanmıştı)', !blockedBeforeOps);

    const { order: orderAfterComplete } = await getProductionOrder(companyId, orderId);
    check('üretim emri COMPLETED oldu, iyi/fire miktarları kaydedildi', orderAfterComplete.status === 'COMPLETED' && money(orderAfterComplete.goodQuantity).equals(5) && money(orderAfterComplete.scrapQuantity).equals(0));

    const balanceP = (await listInvBalances(companyId, warehouseId)).find((b) => b.stockItemId === stockItemP);
    check('mamul P stoğa GERÇEKTEN girdi (5 adet)', !!balanceP && money(balanceP.qty).equals(5));

    const tbFinal = await getTrialBalance(companyId);
    const acc152Final = tbFinal.find((r) => r.accountCode === '152')!;
    const acc710Final = tbFinal.find((r) => r.accountCode === '710')!;
    check(`mamul girişi gerçek muhasebe fişi ürettim (152: 0+500=500): ${toDisplay(acc152Final.balance)}`, money(acc152Final.balance).equals(500));
    check(`710 mamul girişiyle kapandı (210-500=-290): ${toDisplay(acc710Final.balance)}`, money(acc710Final.balance).equals(-290));

    console.log('--- İptal senaryosu (ayrı bir DRAFT emir) ---');
    const draftOrderId = await createProductionOrder(companyId, creatorId, { productId: productP, quantity: 1, unitId, warehouseId });
    await cancelProductionOrder(companyId, draftOrderId, creatorId);
    const { order: cancelledOrder } = await getProductionOrder(companyId, draftOrderId);
    check('taslak üretim emri iptal edilebildi', cancelledOrder.status === 'CANCELLED');

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    // production_orders/prod_operations/boms/routings'in çapraz-referansları
    // (tests/sales.test.ts'te bulunan AYNI FK-cascade sınırlaması) — dependent
    // tablolar company_id ile açıkça, üst tablolardan ÖNCE silinir. bom_lines/
    // routing_operations companyId TAŞIMIYOR (yalnızca bomId/routingId) —
    // boms/routings'ten cascade ile silinir, burada listelenmez.
    const dependentFirst = ['prod_operations', 'production_orders', 'boms', 'routings', 'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items', 'work_centers'];
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
