import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, parties, partyRoles, salesOrders, productionOrders } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createWarehouse, createStockItem, recordStockMovement, setStockItemMinQty } from '../src/lib/warehouse';
import { createBom } from '../src/lib/production/bom';
import { createOrder as createSalesOrder } from '../src/lib/sales/orders';
import { createProductionOrder, getProductionOrder } from '../src/lib/production/orders';
import { runMrp, getMrpRun, cancelPlannedOrder } from '../src/lib/mrp/engine';
import { convertPlannedOrderToProduction, convertPlannedOrderToPurchaseRequest } from '../src/lib/mrp/convert';
import { money, toDisplay } from '../src/lib/money';

// Holding ERP Faz 3 — MRP. Diğer üç kalıcı test paketiyle AYNI disiplin.
// Bu testin ASIL amacı: ÇOK SEVİYELİ BOM patlatmasını (P←2×S←3×R, 3 seviye)
// VE aynı ürünün BİRDEN FAZLA seviyede talep görmesi durumunda (R hem
// kendi minimum-stok politikasına hem de S'nin bileşenine sahip) mevcut
// stoğun İKİ KEZ kredilendirilmediğini (paylaşılan arz havuzu düzeltmesi,
// engine.ts'in kendi yorumunda kayıtlı GERÇEK bir tasarım incelemesi
// sırasında bulunan bir hata) kanıtlamak. npm run test:mrp.

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

  await db.insert(companies).values({ id: companyId, name: 'MRP TEST A.Ş.', taxId: '9999999995', taxOffice: 'Test V.D.' });
  await db.insert(users).values({ id: userId, companyId, fullName: 'Planlamacı', email: `test-${Date.now()}@mrp.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true });

  try {
    console.log('--- Ön koşullar: ürünler, BOM zinciri (P←2×S←3×R), depo, stok ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productP = await createProduct(companyId, userId, { sku: 'MAMUL-P', name: 'Mamul P', baseUnitId: unitId });
    const productS = await createProduct(companyId, userId, { sku: 'ARA-S', name: 'Ara Mamul S', baseUnitId: unitId });
    const productR = await createProduct(companyId, userId, { sku: 'HAM-R', name: 'Hammadde R', baseUnitId: unitId });
    const warehouseId = await createWarehouse(companyId, 'MRP Deposu');

    await createBom(companyId, userId, { productId: productP, code: 'BOM-P', name: 'Mamul P Reçetesi', baseQuantity: 1, unitId, lines: [{ componentProductId: productS, quantity: 2, unitId }] });
    await createBom(companyId, userId, { productId: productS, code: 'BOM-S', name: 'Ara Mamul S Reçetesi', baseQuantity: 1, unitId, lines: [{ componentProductId: productR, quantity: 3, unitId }] });
    check('3 ürünlü, 3 seviyeli BOM zinciri kuruldu (P←2×S←3×R)', true);

    // R: minimum stok politikası=10, mevcut stok=4 (hem MIN_STOCK hem BOM_EXPLOSION seviyesinde talep görecek — paylaşılan arz havuzu testi).
    const stockItemR = await createStockItem(companyId, { sku: 'HAM-R', name: 'Hammadde R', productId: productR });
    await recordStockMovement({ companyId, warehouseId, stockItemId: stockItemR, movementType: 'IN', quantity: 4, unitCost: 5, transactionDate: '2026-01-01', createdByUserId: userId });
    await setStockItemMinQty(companyId, stockItemR, 10);
    check('R için minimum stok=10, mevcut stok=4 ayarlandı', true);

    // S: açık (RELEASED) bir üretim emri zaten var — miktar=3, henüz üretilmedi (scheduled production netlemesi testi).
    const scheduledSOrderId = await createProductionOrder(companyId, userId, { productId: productS, quantity: 3, unitId, warehouseId });
    await db.update(productionOrders).set({ status: 'RELEASED' }).where(eq(productionOrders.id, scheduledSOrderId));
    check('S için açık (RELEASED) bir üretim emri (miktar=3) oluşturuldu', true);

    // Satış talebi: 10×P, CONFIRMED (workflow seremonisini atlayıp doğrudan durumu ayarlıyoruz — bu testin odağı MRP'nin KENDİSİ, Sales'in onay akışı zaten tests/sales.test.ts'te doğrulandı).
    const partyId = newId();
    await db.insert(parties).values({ id: partyId, companyId, legalName: 'MRP Test Müşterisi', code: 'MRPCUST', createdByUserId: userId });
    await db.insert(partyRoles).values({ id: newId(), partyId, role: 'CUSTOMER' });
    const salesOrderId = await createSalesOrder(companyId, userId, { partyId, orderDate: '2026-01-05', currencyCode: 'TRY', lines: [{ productId: productP, quantity: 10, unitPrice: 100 }] });
    await db.update(salesOrders).set({ status: 'CONFIRMED' }).where(eq(salesOrders.id, salesOrderId));
    check('10×P için CONFIRMED satış talebi oluşturuldu', true);

    console.log('--- MRP Koşusu ---');
    const mrpRunId = await runMrp(companyId, userId, warehouseId, '2026-01-10');
    const { run, plannedOrders } = await getMrpRun(companyId, mrpRunId);
    check('MRP koşusu COMPLETED durumunda bitti', run.status === 'COMPLETED');

    const pOrders = plannedOrders.filter((p) => p.productId === productP);
    const sOrders = plannedOrders.filter((p) => p.productId === productS);
    const rOrders = plannedOrders.filter((p) => p.productId === productR);

    check(`P için TEK bir üretim önerisi, miktar=10 (stok/açık sipariş yok): ${pOrders.map((o) => o.quantity).join(',')}`, pOrders.length === 1 && money(pOrders[0].quantity).equals(10) && pOrders[0].orderType === 'PRODUCTION' && pOrders[0].demandSource === 'SALES_ORDER');

    // S: gross talep = 2×10=20, açık üretim(3) düşülür => net=17.
    check(`S için TEK bir üretim önerisi, miktar=17 (20 brüt − 3 açık üretim): ${sOrders.map((o) => o.quantity).join(',')}`, sOrders.length === 1 && money(sOrders[0].quantity).equals(17) && sOrders[0].orderType === 'PRODUCTION' && sOrders[0].demandSource === 'BOM_EXPLOSION');
    check('S önerisinin üst kalemi P önerisidir (izlenebilirlik)', sOrders[0]?.parentId === pOrders[0]?.id);

    // R: MIN_STOCK seviyesinde (6=10-4) VE BOM_EXPLOSION seviyesinde (3×17=51) talep görür.
    // PAYLAŞILAN ARZ HAVUZU olmadan (hatalı davranış): iki öneri de bağımsız 4 birim mevcut stoğu düşerdi -> 2 + 47 = 49 (YANLIŞ, düşük sipariş).
    // Doğru (bu düzeltmeyle): toplam brüt 6+51=57, mevcut stok(4) BİR KEZ düşülür -> net toplam 53.
    const rTotal = rOrders.reduce((acc, o) => acc.plus(money(o.quantity)), money(0));
    check(`R için toplam net miktar DOĞRU (57 brüt − 4 mevcut stok = 53, PAYLAŞILAN havuz düzeltmesi): ${toDisplay(rTotal)} (${rOrders.length} öneri: ${rOrders.map((o) => `${o.demandSource}=${o.quantity}`).join(', ')})`, rTotal.equals(53));
    check('R önerilerinin TÜMÜ satın alma türünde (BOM\'u yok)', rOrders.every((o) => o.orderType === 'PURCHASE'));
    const rFromBom = rOrders.find((o) => o.demandSource === 'BOM_EXPLOSION');
    check('R\'nin BOM_EXPLOSION kaynaklı önerisinin üst kalemi S önerisidir', rFromBom?.parentId === sOrders[0]?.id);

    console.log('--- Dönüştürme ---');
    const productionSuggestion = pOrders[0];
    const newProductionOrderId = await convertPlannedOrderToProduction(companyId, productionSuggestion.id, userId);
    const { order: convertedOrder } = await getProductionOrder(companyId, newProductionOrderId);
    check('P önerisi GERÇEK bir üretim emrine dönüştü (doğru miktar+ürün+depo ile)', convertedOrder.productId === productP && money(convertedOrder.quantity).equals(10) && convertedOrder.warehouseId === warehouseId);

    const { plannedOrders: plannedOrdersAfterConvert } = await getMrpRun(companyId, mrpRunId);
    const pOrderAfterConvert = plannedOrdersAfterConvert.find((o) => o.id === productionSuggestion.id)!;
    check('dönüştürülen öneri CONVERTED işaretlendi, gerçek emre bağlandı', pOrderAfterConvert.status === 'CONVERTED' && pOrderAfterConvert.convertedOrderId === newProductionOrderId);

    let doubleConvertBlocked = false;
    try {
      await convertPlannedOrderToProduction(companyId, productionSuggestion.id, userId);
    } catch {
      doubleConvertBlocked = true;
    }
    check('zaten dönüştürülmüş bir öneri TEKRAR dönüştürülemez', doubleConvertBlocked);

    const purchaseSuggestion = rOrders.find((o) => o.demandSource === 'MIN_STOCK')!;
    const newProcRequestId = await convertPlannedOrderToPurchaseRequest(companyId, purchaseSuggestion.id, userId);
    check('R (MIN_STOCK) önerisi GERÇEK bir satın alma talebine dönüştü', !!newProcRequestId);

    console.log('--- İptal ---');
    const cancelTarget = sOrders[0];
    await cancelPlannedOrder(companyId, cancelTarget.id);
    const { plannedOrders: plannedOrdersAfterCancel } = await getMrpRun(companyId, mrpRunId);
    check('S önerisi CANCELLED olarak işaretlendi', plannedOrdersAfterCancel.find((o) => o.id === cancelTarget.id)?.status === 'CANCELLED');

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // mrp_planned_orders.parent_id KENDİ tablosuna öz-referans (BOM
    // patlatmasının izlenebilirliği) — TEK bir "WHERE company_id=?" DELETE'i,
    // bir satırın (ör. S önerisi) HÂLÂ başka bir satırca (R önerisi)
    // referans edilirken silinmesini garantili ÖNLEYEMİYOR (GERÇEK bulgu).
    // "Hiç kimsenin ebeveyni olmayan" satırları (yapraklar) tekrar tekrar
    // silmek, zincir derinliği ne olursa olsun (MAX_EXPLOSION_DEPTH=10)
    // güvenle temizler.
    for (let i = 0; i < 10; i++) {
      await cleanupConn.query(
        `DELETE t1 FROM mrp_planned_orders t1 LEFT JOIN mrp_planned_orders t2 ON t2.parent_id = t1.id WHERE t1.company_id = ? AND t2.id IS NULL`,
        [companyId]
      );
    }
    const dependentFirst = [
      'mrp_runs', 'sales_order_lines', 'sales_orders', 'parties',
      'production_orders', 'boms', 'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items',
      'proc_request_lines', 'proc_requests'
    ];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]).catch(() => {});
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
