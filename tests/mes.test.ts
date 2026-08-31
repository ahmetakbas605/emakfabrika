import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, prodOperations, machineDowntimes, accountingAccounts } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, openPeriod } from '../src/lib/accounting';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createWarehouse, createStockItem, recordStockMovement } from '../src/lib/warehouse';
import { createWorkCenter } from '../src/lib/production/workcenters';
import { createBom } from '../src/lib/production/bom';
import { createRouting } from '../src/lib/production/routing';
import { createProductionOrder, submitProductionOrder, actOnProductionOrderStep, getProductionOrder } from '../src/lib/production/orders';
import { issueProductionMaterials, startProdOperation, completeProdOperation } from '../src/lib/production/execution';
import { createWorkflowRule, listPendingApprovalsForUser } from '../src/lib/workflow/engine';
import { createMachine } from '../src/lib/mes/machines';
import { recordDowntimeStart, recordDowntimeEnd, listMachineDowntimes } from '../src/lib/mes/downtime';
import { getOeeForOperation, getMachineOeeSummary } from '../src/lib/mes/oee';
import { MesError } from '../src/lib/mes/errors';

// Holding ERP Faz 4 — MES/OEE. Diğer kalıcı test paketleriyle AYNI disiplin.
// Bu testin odağı: OEE = Availability × Performance × Quality formülünün
// TAM olarak doğru hesaplandığını, kontrollü (elle ayarlanmış) zaman
// damgalarıyla KANITLAMAK — 5/9 gibi net bir kesire indirgenen, tesadüfen
// tutmayacak bir senaryo seçildi. npm run test:mes.

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

  await db.insert(companies).values({ id: companyId, name: 'MES TEST A.Ş.', taxId: '9999999996', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: creatorId, companyId, fullName: 'Üretim Operatörü', email: `test-${Date.now()}-creator@mes.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: approverId, companyId, fullName: 'Üretim Müdürü', email: `test-${Date.now()}-approver@mes.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false }
  ]);

  try {
    console.log('--- Ön koşullar: ürün, BOM, routing, iş merkezi, makine (ideal çevrim=20sn) ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productId = await createProduct(companyId, creatorId, { sku: 'MES-URUN', name: 'MES Test Ürünü', baseUnitId: unitId });
    const componentId = await createProduct(companyId, creatorId, { sku: 'MES-BILESEN', name: 'MES Bileşeni', baseUnitId: unitId });
    const warehouseId = await createWarehouse(companyId, 'MES Deposu');
    const workCenterId = await createWorkCenter(companyId, { code: 'WC-MES', name: 'MES Test Hattı' });
    const machineId = await createMachine(companyId, { workCenterId, code: 'MC-1', name: 'Test Makinesi 1', idealCycleTimeSeconds: 20 });

    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '153', name: 'Bileşen Stok Değeri', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');
    const [account153] = await db.select().from(accountingAccounts).where(and(eq(accountingAccounts.companyId, companyId), eq(accountingAccounts.code, '153')));
    const componentStockItemId = await createStockItem(companyId, { sku: 'MES-BILESEN', name: 'MES Bileşeni', productId: componentId, accountingAccountId: account153.id });
    await recordStockMovement({ companyId, warehouseId, stockItemId: componentStockItemId, movementType: 'IN', quantity: 500, unitCost: 5, counterAccountCode: '100', transactionDate: '2026-01-05', createdByUserId: creatorId });

    await createBom(companyId, creatorId, { productId, code: 'BOM-MES', name: 'MES Test Reçetesi', baseQuantity: 1, unitId, lines: [{ componentProductId: componentId, quantity: 1, unitId }] });
    await createRouting(companyId, creatorId, { productId, code: 'RT-MES', name: 'MES Test Rotası', operations: [{ workCenterId, name: 'Tek Operasyon' }] });
    check('ön koşullar hazırlandı', true);

    console.log('--- Üretim emri → onay → RELEASED (1 operasyon otomatik üretildi) ---');
    const orderId = await createProductionOrder(companyId, creatorId, { productId, quantity: 100, unitId, warehouseId });
    await createWorkflowRule(companyId, { documentType: 'PRODUCTION_ORDER', name: 'MES Test Onayı', approvalChain: [{ approverType: 'SPECIFIC_USER', approverValue: approverId, mode: 'SEQUENTIAL' }] });
    await submitProductionOrder(companyId, orderId, creatorId);
    const pending = await listPendingApprovalsForUser(companyId, approverId);
    const stepId = pending.find((p) => p.documentType === 'PRODUCTION_ORDER')?.stepId;
    if (!stepId) throw new Error('Onay adımı bulunamadı.');
    await actOnProductionOrderStep(companyId, { stepId, actingUserId: approverId, decision: 'APPROVE' });
    await issueProductionMaterials(companyId, orderId, creatorId, { transactionDate: '2026-01-10' });
    const { operations } = await getProductionOrder(companyId, orderId);
    check('tek operasyon otomatik üretildi', operations.length === 1);
    const operationId = operations[0].id;

    console.log('--- Operasyonu makineyle başlat, duruş kaydet, tamamla ---');
    await startProdOperation(companyId, operationId, creatorId, machineId);
    const [opAfterStart] = await db.select().from(prodOperations).where(eq(prodOperations.id, operationId)).limit(1);
    check('operasyon makineyle IN_PROGRESS oldu', opAfterStart.status === 'IN_PROGRESS' && opAfterStart.machineId === machineId);

    // Gerçek saat yerine ELLE ayarlanmış, saniye hassasiyetli bir başlangıç/
    // bitiş kullanılıyor — timestamp kolonu saniye çözünürlüğünde olduğundan
    // iki ardışık new Date() çağrısı aynı saniyeye yuvarlanıp yarış durumuna
    // (start==end veya end<start) yol açabilir; bu belirsizliği ortadan kaldırır.
    const downtimeId = await recordDowntimeStart(companyId, creatorId, { machineId, operationId, reasonCode: 'BREAKDOWN', notes: 'Test arızası', startedAt: '2026-01-10T08:20:00Z' });
    let doubleOpenBlocked = false;
    try {
      await recordDowntimeStart(companyId, creatorId, { machineId, reasonCode: 'BREAKDOWN' });
    } catch (err) {
      doubleOpenBlocked = err instanceof MesError;
    }
    check('aynı makinede İKİNCİ bir açık duruş reddedildi', doubleOpenBlocked);
    await recordDowntimeEnd(companyId, downtimeId, '2026-01-10T08:30:00Z');
    let doubleCloseBlocked = false;
    try {
      await recordDowntimeEnd(companyId, downtimeId, '2026-01-10T08:35:00Z');
    } catch (err) {
      doubleCloseBlocked = err instanceof MesError;
    }
    check('zaten kapatılmış bir duruş TEKRAR kapatılamaz', doubleCloseBlocked);

    await completeProdOperation(companyId, operationId, { goodQuantity: 100, scrapQuantity: 5 });

    // --- Kontrollü zaman damgaları: operasyon 08:00-09:00 (3600 sn), duruş 08:20-08:30 (600 sn) ---
    const opStart = new Date('2026-01-10T08:00:00Z');
    const opEnd = new Date('2026-01-10T09:00:00Z');
    const dtStart = new Date('2026-01-10T08:20:00Z');
    const dtEnd = new Date('2026-01-10T08:30:00Z');
    await db.update(prodOperations).set({ startedAt: opStart, completedAt: opEnd }).where(eq(prodOperations.id, operationId));
    await db.update(machineDowntimes).set({ startedAt: dtStart, endedAt: dtEnd }).where(eq(machineDowntimes.id, downtimeId));
    check('kontrollü zaman damgaları ayarlandı (operasyon=3600sn, duruş=600sn)', true);

    console.log('--- OEE hesabı doğrulanıyor ---');
    const oee = await getOeeForOperation(companyId, operationId);
    check(`toplam süre doğru (3600 sn): ${oee.totalTimeSeconds}`, oee.totalTimeSeconds === 3600);
    check(`duruş süresi doğru (600 sn): ${oee.downtimeSeconds}`, oee.downtimeSeconds === 600);
    check(`çalışma süresi doğru (3000 sn): ${oee.runTimeSeconds}`, oee.runTimeSeconds === 3000);
    check(`Kullanılabilirlik doğru (3000/3600=5/6=%83.33): ${(oee.availability * 100).toFixed(2)}`, Math.abs(oee.availability - 5 / 6) < 0.0001);
    check(`Kalite doğru (100/105=20/21=%95.24): ${(oee.quality * 100).toFixed(2)}`, Math.abs(oee.quality - 20 / 21) < 0.0001);
    check(`Performans doğru (20sn×105/3000sn=7/10=%70): ${oee.performance !== null ? (oee.performance * 100).toFixed(2) : 'null'}`, oee.performance !== null && Math.abs(oee.performance - 0.7) < 0.0001);
    check(`OEE TAM doğru (5/6×7/10×20/21=5/9=%55.56): ${oee.oee !== null ? (oee.oee * 100).toFixed(2) : 'null'}`, oee.oee !== null && Math.abs(oee.oee - 5 / 9) < 0.0001);

    console.log('--- İdeal çevrim süresi tanımsız makinede Performance/OEE null olmalı ---');
    const machineNoIdealId = await createMachine(companyId, { workCenterId, code: 'MC-2', name: 'İdeal Süresiz Makine' });
    // Aynı operasyonu geçici olarak bu makineye taşıyıp tekrar sorguluyoruz (yalnızca bu kontrol için, kalıcı bir durum değişikliği değil önemi yok — test şirketi zaten temizlenecek).
    await db.update(prodOperations).set({ machineId: machineNoIdealId }).where(eq(prodOperations.id, operationId));
    const oeeNoIdeal = await getOeeForOperation(companyId, operationId);
    check('idealCycleTimeSeconds tanımsızken Performance=null (sessizce %100 varsayılmadı)', oeeNoIdeal.performance === null);
    check('idealCycleTimeSeconds tanımsızken OEE=null (Availability/Quality yine de hesaplandı)', oeeNoIdeal.oee === null && oeeNoIdeal.availability > 0 && oeeNoIdeal.quality > 0);
    await db.update(prodOperations).set({ machineId }).where(eq(prodOperations.id, operationId)); // geri al

    console.log('--- Makine OEE özeti (tarih aralığı) tek operasyonla eşleşmeli ---');
    const summary = await getMachineOeeSummary(companyId, machineId, '2026-01-01', '2026-01-31');
    check('özet 1 operasyonu kapsıyor', summary.operationCount === 1);
    check(`özetin OEE'si tekil operasyonla AYNI (5/9): ${summary.oee !== null ? (summary.oee * 100).toFixed(2) : 'null'}`, summary.oee !== null && Math.abs(summary.oee - 5 / 9) < 0.0001);

    console.log('--- Hata senaryoları ---');
    let notCompletedBlocked = false;
    try {
      const secondOrderId = await createProductionOrder(companyId, creatorId, { productId, quantity: 1, unitId, warehouseId });
      await submitProductionOrder(companyId, secondOrderId, creatorId);
      const pending2 = await listPendingApprovalsForUser(companyId, approverId);
      const stepId2 = pending2.find((p) => p.documentType === 'PRODUCTION_ORDER')?.stepId!;
      await actOnProductionOrderStep(companyId, { stepId: stepId2, actingUserId: approverId, decision: 'APPROVE' });
      const { operations: ops2 } = await getProductionOrder(companyId, secondOrderId);
      await getOeeForOperation(companyId, ops2[0].id); // henüz PENDING, hiç başlamadı
    } catch (err) {
      notCompletedBlocked = err instanceof MesError;
    }
    check('tamamlanmamış bir operasyon için OEE istemi reddedildi', notCompletedBlocked);

    const downtimes = await listMachineDowntimes(companyId, machineId);
    check('duruş geçmişi doğru sayıda kayıt içeriyor (1)', downtimes.length === 1);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    const dependentFirst = [
      'machine_downtimes', 'prod_operations', 'production_orders', 'boms', 'routings', 'machines',
      'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items', 'work_centers'
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
