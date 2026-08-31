import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, serviceDeskTickets, maintenanceWorkOrders, workOrders, accountingAccounts, prodOperations } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createDepartment } from '../src/lib/departments';
import { createAccount, openPeriod } from '../src/lib/accounting';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createWarehouse, createStockItem, recordStockMovement } from '../src/lib/warehouse';
import { createWorkCenter } from '../src/lib/production/workcenters';
import { createBom } from '../src/lib/production/bom';
import { createRouting } from '../src/lib/production/routing';
import { createWorkflowRule, listPendingApprovalsForUser } from '../src/lib/workflow/engine';
import { createProductionOrder, submitProductionOrder, actOnProductionOrderStep, getProductionOrder } from '../src/lib/production/orders';
import { issueProductionMaterials, startProdOperation, completeProdOperation } from '../src/lib/production/execution';
import { createEamAsset, getEamAsset, listEamAssets, changeEamAssetStatus } from '../src/lib/eam/assets';
import { createMaintenancePlan, listMaintenancePlans, listEamMaintenancePlans, runDueMaintenanceGeneration, revertAssetAfterMaintenanceIfApplicable } from '../src/lib/it/maintenance';
import { transitionTicket } from '../src/lib/it/tickets';
import { createEnergyMeter, recordEnergyReading, listEnergyMeters, listEnergyReadings, getEnergyPerUnit } from '../src/lib/eam/energy';
import { EamError } from '../src/lib/eam/errors';

// Holding ERP Faz 6 (EAM + Enerji) — Diğer kalıcı test paketleriyle AYNI
// disiplin: gerçek MySQL'e karşı, mock YOK. npm run test:eam. Bu testin
// özel odağı: maintenancePlans'ın YENİ eamAssetId/departmentId alanlarının
// (a) mevcut IT davranışını KIRMADIĞINI (departmanı boş bir plan hâlâ
// fallback departmana düşer) ve (b) EAM planının KENDİ departmanına doğru
// yönlendiğini (fallback'e DEĞİL) TEK bir runDueMaintenanceGeneration
// çağrısıyla kanıtlamak.

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
  const adminId = newId();
  const approverId = newId();

  await db.insert(companies).values({ id: companyId, name: 'EAM TEST A.Ş.', taxId: '9999999998', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: adminId, companyId, fullName: 'Bakım Yöneticisi', email: `test-${Date.now()}-admin@eam.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: approverId, companyId, fullName: 'Üretim Müdürü', email: `test-${Date.now()}-approver@eam.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false }
  ]);

  try {
    console.log('--- Ön koşullar: IT departmanı (fallback) + Bakım departmanı + EAM ekipmanı ---');
    const itDeptId = await createDepartment(companyId, { departmentTypeCode: 'IT', name: 'Bilgi Teknolojileri' });
    const bakimDeptId = await createDepartment(companyId, { departmentTypeCode: 'WAREHOUSE', name: 'Bakım' });
    const compressorId = await createEamAsset(companyId, { assetTypeCode: 'COMPRESSOR', code: 'KOMP-1', name: 'Ana Kompresör', locationNote: 'Kazan Dairesi' });
    const assets = await listEamAssets(companyId);
    check('EAM ekipmanı oluşturuldu ve listelendi', assets.length === 1 && assets[0].id === compressorId);

    console.log('--- Bakım planları: 1 eski-tarz IT planı (departmanı BOŞ) + 1 EAM planı (kendi departmanı DOLU) ---');
    const today = new Date().toISOString().slice(0, 10);
    const itPlanId = await createMaintenancePlan(companyId, { title: 'IT Genel Bakım (departman boş)', maintenanceType: 'PREVENTIVE', frequency: 'DAILY', intervalValue: 1, startDate: today });
    const eamPlanId = await createMaintenancePlan(companyId, { eamAssetId: compressorId, departmentId: bakimDeptId, title: 'Kompresör Periyodik Bakım', maintenanceType: 'PREVENTIVE', frequency: 'DAILY', intervalValue: 1, startDate: today });

    const allPlans = await listMaintenancePlans(companyId);
    check('listMaintenancePlans HER İKİ planı da görüyor (2)', allPlans.length === 2);
    const eamOnlyPlans = await listEamMaintenancePlans(companyId);
    check('listEamMaintenancePlans YALNIZCA EAM planını görüyor (1)', eamOnlyPlans.length === 1 && eamOnlyPlans[0].id === eamPlanId);

    console.log('--- TEK runDueMaintenanceGeneration çağrısı (fallback=IT departmanı) — iki plan da bugün vadeli ---');
    const genResult = await runDueMaintenanceGeneration(companyId, itDeptId, adminId);
    check(`iki iş emri de üretildi (2): ${genResult.generatedCount}`, genResult.generatedCount === 2);

    const [itWorkOrder] = await db.select().from(maintenanceWorkOrders).where(eq(maintenanceWorkOrders.maintenancePlanId, itPlanId));
    const [eamWorkOrder] = await db.select().from(maintenanceWorkOrders).where(eq(maintenanceWorkOrders.maintenancePlanId, eamPlanId));
    const [itTicket] = await db.select({ departmentId: serviceDeskTickets.departmentId }).from(workOrders).innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId)).where(eq(workOrders.id, itWorkOrder.workOrderId));
    const [eamTicket] = await db.select({ id: serviceDeskTickets.id, departmentId: serviceDeskTickets.departmentId }).from(workOrders).innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId)).where(eq(workOrders.id, eamWorkOrder.workOrderId));

    check('departmanı BOŞ olan IT planının ticket\'ı FALLBACK (IT) departmanına düştü — geriye uyumluluk KORUNDU', itTicket.departmentId === itDeptId);
    check('EAM planının ticket\'ı KENDİ departmanına (Bakım) düştü, fallback\'e DEĞİL', eamTicket.departmentId === bakimDeptId);

    const [itPlanAfter] = await listMaintenancePlans(companyId);
    void itPlanAfter;
    const eamPlanAfter = (await listEamMaintenancePlans(companyId))[0];
    check(`EAM planının nextDueDate bir gün ilerledi: ${eamPlanAfter.nextDueDate}`, eamPlanAfter.nextDueDate > today);

    console.log('--- Bakım tamamlanması → EAM ekipmanı otomatik IN_SERVICE\'e döner ---');
    await changeEamAssetStatus(companyId, compressorId, 'UNDER_MAINTENANCE');
    check('ekipman UNDER_MAINTENANCE olarak işaretlendi', (await getEamAsset(companyId, compressorId)).status === 'UNDER_MAINTENANCE');

    for (const step of ['ASSIGNED', 'ACCEPTED', 'WORKING', 'TESTING', 'RESOLVED', 'USER_APPROVAL_PENDING', 'CLOSED']) {
      await transitionTicket(companyId, eamTicket.id, step, adminId);
    }
    await revertAssetAfterMaintenanceIfApplicable(companyId, eamTicket.id, adminId);
    check('ticket CLOSED olunca ekipman OTOMATİK IN_SERVICE\'e döndü', (await getEamAsset(companyId, compressorId)).status === 'IN_SERVICE');

    let notFoundRejected = false;
    try {
      await changeEamAssetStatus(companyId, newId(), 'IN_SERVICE');
    } catch (err) {
      notFoundRejected = err instanceof EamError;
    }
    check('olmayan bir ekipman için durum değişikliği reddedildi', notFoundRejected);

    console.log('--- Enerji: gerçek iş merkezi + üretim operasyonu üzerinden ürün-başı hesap ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productId = await createProduct(companyId, adminId, { sku: 'EAM-URUN', name: 'EAM Test Ürünü', baseUnitId: unitId });
    const componentId = await createProduct(companyId, adminId, { sku: 'EAM-BILESEN', name: 'EAM Bileşeni', baseUnitId: unitId });
    const warehouseId = await createWarehouse(companyId, 'EAM Deposu');

    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '153', name: 'Bileşen Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');
    const [account153] = await db.select().from(accountingAccounts).where(and(eq(accountingAccounts.companyId, companyId), eq(accountingAccounts.code, '153')));
    const componentStockItemId = await createStockItem(companyId, { sku: 'EAM-BILESEN', name: 'EAM Bileşeni', productId: componentId, accountingAccountId: account153.id });
    await recordStockMovement({ companyId, warehouseId, stockItemId: componentStockItemId, movementType: 'IN', quantity: 500, unitCost: 5, counterAccountCode: '100', transactionDate: '2026-02-01', createdByUserId: adminId });

    const workCenterId = await createWorkCenter(companyId, { code: 'WC-EAM', name: 'EAM Test Hattı' });
    await createBom(companyId, adminId, { productId, code: 'BOM-EAM', name: 'EAM Test Reçetesi', baseQuantity: 1, unitId, lines: [{ componentProductId: componentId, quantity: 1, unitId }] });
    await createRouting(companyId, adminId, { productId, code: 'RT-EAM', name: 'EAM Test Rotası', operations: [{ workCenterId, name: 'Tek Operasyon' }] });

    const orderId = await createProductionOrder(companyId, adminId, { productId, quantity: 100, unitId, warehouseId });
    await createWorkflowRule(companyId, { documentType: 'PRODUCTION_ORDER', name: 'EAM Test Onayı', approvalChain: [{ approverType: 'SPECIFIC_USER', approverValue: approverId, mode: 'SEQUENTIAL' }] });
    await submitProductionOrder(companyId, orderId, adminId);
    const pending = await listPendingApprovalsForUser(companyId, approverId);
    const stepId = pending.find((p) => p.documentType === 'PRODUCTION_ORDER')?.stepId;
    if (!stepId) throw new Error('Onay adımı bulunamadı.');
    await actOnProductionOrderStep(companyId, { stepId, actingUserId: approverId, decision: 'APPROVE' });
    await issueProductionMaterials(companyId, orderId, adminId, { transactionDate: '2026-02-10' });
    const { operations } = await getProductionOrder(companyId, orderId);
    const operationId = operations[0].id;
    await startProdOperation(companyId, operationId, adminId);
    await completeProdOperation(companyId, operationId, { goodQuantity: 100, scrapQuantity: 0 });
    // Kontrollü tamamlanma tarihi — dönem filtresinin (Şubat) İÇİNDE.
    await db.update(prodOperations).set({ completedAt: new Date('2026-02-20T12:00:00Z') }).where(eq(prodOperations.id, operationId));

    const meterId = await createEnergyMeter(companyId, { code: 'ELK-1', name: 'Hat Elektrik Sayacı', energyType: 'ELECTRICITY', unit: 'kWh', workCenterId });
    await recordEnergyReading(companyId, adminId, { meterId, periodStart: '2026-02-01', periodEnd: '2026-02-15', consumption: 300 });
    await recordEnergyReading(companyId, adminId, { meterId, periodStart: '2026-02-16', periodEnd: '2026-02-28', consumption: 200, cost: 750 });
    await recordEnergyReading(companyId, adminId, { meterId, periodStart: '2026-03-01', periodEnd: '2026-03-15', consumption: 999 }); // dönem DIŞI, hesaba KATILMAMALI

    let invalidPeriodRejected = false;
    try {
      await recordEnergyReading(companyId, adminId, { meterId, periodStart: '2026-02-20', periodEnd: '2026-02-10', consumption: 10 });
    } catch (err) {
      invalidPeriodRejected = err instanceof EamError;
    }
    check('dönem bitişi başlangıçtan önce olan okuma reddedildi', invalidPeriodRejected);

    const meters = await listEnergyMeters(companyId);
    check('sayaç listelendi (1)', meters.length === 1 && meters[0].workCenterId === workCenterId);
    const readings = await listEnergyReadings(companyId, meterId);
    check('3 tüketim kaydı listelendi', readings.length === 3);

    const perUnit = await getEnergyPerUnit(companyId, workCenterId, '2026-02-01', '2026-02-28');
    check(`toplam tüketim doğru (300+200=500, Mart HARİÇ): ${perUnit.totalConsumption}`, perUnit.totalConsumption === 500);
    check(`toplam maliyet doğru (0+750=750): ${perUnit.totalCost}`, perUnit.totalCost === 750);
    check(`toplam iyi üretim doğru (100): ${perUnit.totalGoodQuantity}`, perUnit.totalGoodQuantity === 100);
    check(`ürün-başı enerji TAM doğru (500/100=5): ${perUnit.energyPerUnit}`, perUnit.energyPerUnit === 5);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    // service_desk_tickets siline siline ticket_status_history/work_orders/
    // maint_work_orders'ın HEPSİ onDelete:'cascade' ile OTOMATİK gider —
    // ayrı JOIN'li silmelere gerek yok (schema.ts'in kendi FK tanımları).
    await cleanupConn.query(`DELETE FROM service_desk_tickets WHERE company_id = ?`, [companyId]);
    const dependentFirst = [
      'energy_readings', 'energy_meters', 'maint_plans', 'eam_assets',
      'prod_operations', 'production_orders', 'boms', 'routings', 'work_centers',
      'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items', 'warehouses', 'departments'
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
