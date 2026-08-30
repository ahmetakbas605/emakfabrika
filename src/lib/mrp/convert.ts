import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { mrpPlannedOrders, products } from '@/db/schema';
import { createProductionOrder } from '@/lib/production/orders';
import { createProcRequest } from '@/lib/procurement/requisition';
import { MrpError } from './errors';

// Holding ERP Faz 3 — bir MRP önerisini GERÇEK bir belgeye dönüştürür.
// createProductionOrder/createProcRequest KENDİ transaction'ını açıyor
// (Faz 2'de ...InTx varyantı YOK) — bu yüzden "belge oluştur + öneriyi
// CONVERTED işaretle" burada iki AYRI adım (tam atomiklik değil). Kabul
// edilen risk: ikinci adım (basit bir UPDATE) başarısız olursa öneri
// SUGGESTED görünmeye devam eder ama GERÇEK belge zaten oluşmuştur —
// veri bütünlüğü bozulmaz, yalnızca öneri durumu geriden gelir (kullanıcı
// tekrar dönüştürmeyi denerse ikinci belge oluşmasın diye status kontrolü
// zaten var, bu riski pratikte zararsız kılıyor).

export async function convertPlannedOrderToProduction(companyId: string, plannedOrderId: string, userId: string): Promise<string> {
  const [row] = await db.select().from(mrpPlannedOrders).where(and(eq(mrpPlannedOrders.id, plannedOrderId), eq(mrpPlannedOrders.companyId, companyId))).limit(1);
  if (!row) throw new MrpError('Önerilen emir bulunamadı.');
  if (row.status !== 'SUGGESTED') throw new MrpError('Yalnızca önerilen (SUGGESTED) bir kalem dönüştürülebilir.');
  if (row.orderType !== 'PRODUCTION') throw new MrpError('Bu öneri bir üretim emri değil.');

  const productionOrderId = await createProductionOrder(companyId, userId, { productId: row.productId, quantity: Number(row.quantity), unitId: row.unitId, warehouseId: row.warehouseId, plannedEndDate: row.dueDate ?? undefined });
  await db.update(mrpPlannedOrders).set({ status: 'CONVERTED', convertedOrderType: 'PRODUCTION_ORDER', convertedOrderId: productionOrderId }).where(eq(mrpPlannedOrders.id, plannedOrderId));
  return productionOrderId;
}

export async function convertPlannedOrderToPurchaseRequest(companyId: string, plannedOrderId: string, userId: string): Promise<string> {
  const [row] = await db.select().from(mrpPlannedOrders).where(and(eq(mrpPlannedOrders.id, plannedOrderId), eq(mrpPlannedOrders.companyId, companyId))).limit(1);
  if (!row) throw new MrpError('Önerilen emir bulunamadı.');
  if (row.status !== 'SUGGESTED') throw new MrpError('Yalnızca önerilen (SUGGESTED) bir kalem dönüştürülebilir.');
  if (row.orderType !== 'PURCHASE') throw new MrpError('Bu öneri bir satın alma talebi değil.');

  const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, row.productId)).limit(1);
  const requestId = await createProcRequest(companyId, userId, {
    requestType: 'STOCK_REPLENISHMENT',
    justification: 'MRP tarafından önerildi (net ihtiyaç hesaplaması).',
    requestedDeliveryDate: row.dueDate ?? undefined,
    lines: [{ productId: row.productId, description: `MRP önerisi — ${product?.name ?? row.productId}`, quantity: Number(row.quantity), unitId: row.unitId, warehouseId: row.warehouseId }]
  });
  await db.update(mrpPlannedOrders).set({ status: 'CONVERTED', convertedOrderType: 'PROC_REQUEST', convertedOrderId: requestId }).where(eq(mrpPlannedOrders.id, plannedOrderId));
  return requestId;
}
