// Üretim / MES / MRP: İş Merkezleri, Rota, BOM, Üretim Emri (+operasyon),
// Makine, Vardiya, Duruş, MRP Çalıştırma (+önerilen emir).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  products, units, warehouses,
  workCenters, routings, routingOperations,
  boms, bomLines, productionOrders, prodOperations,
  machines, shifts, machineDowntimes,
  mrpRuns, mrpPlannedOrders
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const existingWc = await db.select({ code: workCenters.code }).from(workCenters).where(eq(workCenters.companyId, COMPANY_ID));
    if (existingWc.some((w) => w.code === 'IM-01')) {
      console.log('Üretim verisi zaten var (IM-01), atlandı.');
      return;
    }

    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));
    const unitRows = await db.select().from(units).where(eq(units.companyId, COMPANY_ID));
    const unitByCode = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));
    const [anaDepo] = await db.select().from(warehouses).where(and(eq(warehouses.companyId, COMPANY_ID), eq(warehouses.name, 'Ana Mamul Deposu')));

    // ================= İŞ MERKEZLERİ =================
    const wcIds = { kesim: id(), kaynak: id(), montaj: id() };
    await db.insert(workCenters).values([
      { id: wcIds.kesim, companyId: COMPANY_ID, code: 'IM-01', name: 'Kesim İstasyonu', capacityPerHour: '120.000000' },
      { id: wcIds.kaynak, companyId: COMPANY_ID, code: 'IM-02', name: 'Kaynak İstasyonu', capacityPerHour: '40.000000' },
      { id: wcIds.montaj, companyId: COMPANY_ID, code: 'IM-03', name: 'Montaj Hattı', capacityPerHour: '25.000000' }
    ]);

    // ================= MAKİNE =================
    const machineIds = { lazerKesim: id(), kaynakRobotu: id() };
    await db.insert(machines).values([
      { id: machineIds.lazerKesim, companyId: COMPANY_ID, workCenterId: wcIds.kesim, code: 'MAK-01', name: 'Lazer Kesim Makinesi', idealCycleTimeSeconds: '45.00' },
      { id: machineIds.kaynakRobotu, companyId: COMPANY_ID, workCenterId: wcIds.kaynak, code: 'MAK-02', name: 'Kaynak Robotu', idealCycleTimeSeconds: '90.00' }
    ]);

    // ================= VARDİYA =================
    await db.insert(shifts).values([
      { id: id(), companyId: COMPANY_ID, code: 'GUNDUZ', name: 'Gündüz Vardiyası', startTime: '08:00:00', endTime: '16:00:00', breakMinutes: 60, graceMinutes: 10 },
      { id: id(), companyId: COMPANY_ID, code: 'GECE', name: 'Gece Vardiyası', startTime: '00:00:00', endTime: '08:00:00', breakMinutes: 60, graceMinutes: 10, crossesMidnight: true }
    ]);

    // ================= ROTA (Vana için) =================
    const routingId = id();
    await db.insert(routings).values({ id: routingId, companyId: COMPANY_ID, productId: productBySku['URN-001'], code: 'RTA-VANA-01', name: 'Endüstriyel Vana Üretim Rotası', version: 1, status: 'ACTIVE', createdByUserId: ADMIN_USER_ID });
    await db.insert(routingOperations).values([
      { id: id(), routingId, operationOrder: 1, workCenterId: wcIds.kesim, name: 'Gövde Kesimi', setupTimeMinutes: '15.00', runTimeMinutesPerUnit: '3.5000' },
      { id: id(), routingId, operationOrder: 2, workCenterId: wcIds.kaynak, name: 'Kaynak Birleştirme', setupTimeMinutes: '20.00', runTimeMinutesPerUnit: '8.0000' },
      { id: id(), routingId, operationOrder: 3, workCenterId: wcIds.montaj, name: 'Final Montaj', setupTimeMinutes: '10.00', runTimeMinutesPerUnit: '5.0000' }
    ]);

    // ================= BOM (Vana için) =================
    const bomId = id();
    await db.insert(boms).values({ id: bomId, companyId: COMPANY_ID, productId: productBySku['URN-001'], code: 'BOM-VANA-01', name: 'Endüstriyel Vana Ürün Ağacı', version: 1, status: 'ACTIVE', baseQuantity: '1', unitId: unitByCode['ADET'], effectiveFrom: '2026-01-01', createdByUserId: ADMIN_USER_ID });
    await db.insert(bomLines).values([
      { id: id(), bomId, lineOrder: 1, componentProductId: productBySku['URN-004'], quantity: '2.500000', unitId: unitByCode['KG'], scrapPercent: '5.00' },
      { id: id(), bomId, lineOrder: 2, componentProductId: productBySku['URN-003'], quantity: '8.000000', unitId: unitByCode['ADET'] },
      { id: id(), bomId, lineOrder: 3, componentProductId: productBySku['URN-006'], quantity: '1.000000', unitId: unitByCode['ADET'] }
    ]);
    console.log('3 iş merkezi, 2 makine, 2 vardiya, 1 rota (3 op.), 1 BOM (3 kalem) eklendi.');

    // ================= ÜRETİM EMRİ =================
    const orderId = id();
    await db.insert(productionOrders).values({
      id: orderId, companyId: COMPANY_ID, orderNo: 'UEM20260001', productId: productBySku['URN-001'], bomId, routingId,
      quantity: '100.000000', unitId: unitByCode['ADET'], warehouseId: anaDepo.id,
      plannedStartDate: '2026-09-05', plannedEndDate: '2026-09-12', status: 'IN_PROGRESS',
      materialsIssuedAt: new Date('2026-09-05'), goodQuantity: '65.000000', createdByUserId: ADMIN_USER_ID
    });
    await db.insert(prodOperations).values([
      { id: id(), companyId: COMPANY_ID, orderId, operationOrder: 1, workCenterId: wcIds.kesim, machineId: machineIds.lazerKesim, name: 'Gövde Kesimi', status: 'COMPLETED', startedAt: new Date('2026-09-05T08:00:00'), completedAt: new Date('2026-09-06T14:00:00'), goodQuantity: '98.000000', scrapQuantity: '2.000000' },
      { id: id(), companyId: COMPANY_ID, orderId, operationOrder: 2, workCenterId: wcIds.kaynak, machineId: machineIds.kaynakRobotu, name: 'Kaynak Birleştirme', status: 'IN_PROGRESS', startedAt: new Date('2026-09-06T14:00:00'), goodQuantity: '65.000000' },
      { id: id(), companyId: COMPANY_ID, orderId, operationOrder: 3, workCenterId: wcIds.montaj, name: 'Final Montaj', status: 'PENDING' }
    ]);
    console.log('Üretim emri: UEM20260001 (IN_PROGRESS, 100 adet, 3 operasyon).');

    // ================= DURUŞ (OEE ekranı için) =================
    await db.insert(machineDowntimes).values({ id: id(), companyId: COMPANY_ID, machineId: machineIds.kaynakRobotu, reasonCode: 'MATERIAL_SHORTAGE', startedAt: new Date('2026-09-06T11:00:00'), endedAt: new Date('2026-09-06T11:45:00'), notes: 'Kaynak teli stoğu tükendi, depo takviyesi bekledi.', recordedByUserId: ADMIN_USER_ID });

    // ================= MRP ÇALIŞTIRMA =================
    const mrpRunId = id();
    await db.insert(mrpRuns).values({ id: mrpRunId, companyId: COMPANY_ID, warehouseId: anaDepo.id, runDate: '2026-09-01', status: 'COMPLETED', createdByUserId: ADMIN_USER_ID, completedAt: new Date('2026-09-01T02:00:00') });
    await db.insert(mrpPlannedOrders).values([
      { id: id(), mrpRunId, companyId: COMPANY_ID, productId: productBySku['URN-001'], quantity: '40.000000', unitId: unitByCode['ADET'], warehouseId: anaDepo.id, dueDate: '2026-09-25', orderType: 'PRODUCTION', status: 'SUGGESTED', demandSource: 'MIN_STOCK' },
      { id: id(), mrpRunId, companyId: COMPANY_ID, productId: productBySku['URN-004'], quantity: '3000.000000', unitId: unitByCode['KG'], warehouseId: anaDepo.id, dueDate: '2026-09-18', orderType: 'PURCHASE', status: 'SUGGESTED', demandSource: 'BOM_EXPLOSION' }
    ]);
    console.log('MRP çalıştırma: 1 run, 2 önerilen emir.');

    console.log('\n=== BATCH 4 (Üretim/MES/MRP) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 4 başarısız:', err); process.exit(1); });
