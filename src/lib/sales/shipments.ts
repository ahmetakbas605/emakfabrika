import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { salesShipments, salesShipmentLines, salesOrders, salesOrderLines, warehouses, stockItems } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { recordStockMovementInTx } from '@/lib/warehouse';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Sevkiyat. DRAFT (hazırlandı, stok henüz hareket
// etmedi) → SHIPPED (recordStockMovementInTx ile GERÇEK stok çıkışı +
// sipariş satırlarının shippedQuantity'si güncellenir) → DELIVERED (yalnızca
// durum bilgisi). Rezervasyonların (invReservations) sevkiyatta OTOMATİK
// serbest bırakılması bu fazın KAPSAMI DIŞINDA bırakıldı (kısmi miktar
// serbest bırakma releaseReservationInTx'te desteklenmiyor, tam bir
// yeniden-tasarım gerektirir) — bilinçli bir sınırlama, inv_balance
// backfill TODO'suyla AYNI dürüstlükte not ediliyor.

export interface ShipmentLineInput {
  orderLineId: string;
  quantity: number;
}

export interface CreateShipmentInput {
  orderId: string;
  warehouseId: string;
  shipmentDate: string;
  lines: ShipmentLineInput[];
}

export async function createShipment(companyId: string, createdByUserId: string, input: CreateShipmentInput): Promise<string> {
  if (input.lines.length === 0) throw new SalesError('Sevkiyatta en az bir kalem olmalı.');

  return db.transaction(async (tx) => {
    const [order] = await tx.select({ id: salesOrders.id, status: salesOrders.status }).from(salesOrders).where(and(eq(salesOrders.id, input.orderId), eq(salesOrders.companyId, companyId))).limit(1);
    if (!order) throw new SalesError('Sipariş bulunamadı.');
    if (order.status !== 'CONFIRMED' && order.status !== 'IN_FULFILLMENT') throw new SalesError('Yalnızca onaylanmış (CONFIRMED) veya kısmen sevk edilmiş bir sipariş için sevkiyat oluşturulabilir.');

    const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.companyId, companyId))).limit(1);
    if (!warehouse) throw new SalesError('Depo bulunamadı.');

    const id = newId();
    const shipmentNo = await nextDocumentNo(tx, companyId, 'SLSS', 'SEV', new Date().getFullYear(), 6);
    await tx.insert(salesShipments).values({ id, companyId, shipmentNo, orderId: input.orderId, warehouseId: input.warehouseId, shipmentDate: input.shipmentDate, createdByUserId });

    for (const line of input.lines) {
      const [orderLine] = await tx.select({ id: salesOrderLines.id, quantity: salesOrderLines.quantity, shippedQuantity: salesOrderLines.shippedQuantity, orderId: salesOrderLines.orderId }).from(salesOrderLines).where(eq(salesOrderLines.id, line.orderLineId)).limit(1);
      if (!orderLine || orderLine.orderId !== input.orderId) throw new SalesError('Sipariş kalemi bulunamadı.');
      const remaining = money(orderLine.quantity).minus(orderLine.shippedQuantity);
      if (money(line.quantity).greaterThan(remaining)) throw new SalesError(`Sevk edilen miktar (${line.quantity}), kalan miktardan (${remaining.toFixed(2)}) fazla olamaz.`);
      await tx.insert(salesShipmentLines).values({ id: newId(), shipmentId: id, orderLineId: line.orderLineId, quantity: toDb(line.quantity) });
    }

    return id;
  });
}

export async function listShipments(companyId: string, orderId?: string) {
  const conditions = orderId ? and(eq(salesShipments.companyId, companyId), eq(salesShipments.orderId, orderId)) : eq(salesShipments.companyId, companyId);
  return db.select().from(salesShipments).where(conditions);
}

export async function getShipment(companyId: string, shipmentId: string) {
  const [shipment] = await db.select().from(salesShipments).where(and(eq(salesShipments.id, shipmentId), eq(salesShipments.companyId, companyId))).limit(1);
  if (!shipment) throw new SalesError('Sevkiyat bulunamadı.');
  const lines = await db.select().from(salesShipmentLines).where(eq(salesShipmentLines.shipmentId, shipmentId));
  return { shipment, lines };
}

export async function cancelShipment(companyId: string, shipmentId: string): Promise<void> {
  const [shipment] = await db.select({ status: salesShipments.status }).from(salesShipments).where(and(eq(salesShipments.id, shipmentId), eq(salesShipments.companyId, companyId))).limit(1);
  if (!shipment) throw new SalesError('Sevkiyat bulunamadı.');
  if (shipment.status !== 'DRAFT') throw new SalesError('Yalnızca hazırlanmış (DRAFT) bir sevkiyat iptal edilebilir.');
  await db.update(salesShipments).set({ status: 'CANCELLED' }).where(eq(salesShipments.id, shipmentId));
}

// madde (Sevkiyat → gerçek stok çıkışı). Ürün-stok kartı eşleşmesi OPSİYONEL
// (stockItems.productId doluysa) — recordStockMovement'ın counterAccountCode'u
// İLE AYNI "eşleşme yoksa hareketi ATLA, ZORLAMA" ilkesi.
export async function dispatchShipment(companyId: string, shipmentId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [shipment] = await tx.select().from(salesShipments).where(and(eq(salesShipments.id, shipmentId), eq(salesShipments.companyId, companyId))).limit(1);
    if (!shipment) throw new SalesError('Sevkiyat bulunamadı.');
    if (shipment.status !== 'DRAFT') throw new SalesError('Yalnızca hazırlanmış (DRAFT) bir sevkiyat gönderilebilir.');

    const lines = await tx.select().from(salesShipmentLines).where(eq(salesShipmentLines.shipmentId, shipmentId));
    for (const line of lines) {
      const [orderLine] = await tx.select({ productId: salesOrderLines.productId, shippedQuantity: salesOrderLines.shippedQuantity }).from(salesOrderLines).where(eq(salesOrderLines.id, line.orderLineId)).limit(1);
      if (!orderLine) throw new SalesError('Sipariş kalemi bulunamadı.');

      const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, orderLine.productId), eq(stockItems.companyId, companyId))).limit(1);
      if (stockItem) {
        await recordStockMovementInTx(tx, { companyId, warehouseId: shipment.warehouseId, stockItemId: stockItem.id, movementType: 'OUT', quantity: line.quantity, transactionDate: shipment.shipmentDate, sourceType: 'SALES_SHIPMENT', sourceId: shipmentId, createdByUserId: userId });
      }

      await tx.update(salesOrderLines).set({ shippedQuantity: toDb(money(orderLine.shippedQuantity).plus(line.quantity)) }).where(eq(salesOrderLines.id, line.orderLineId));
    }

    await tx.update(salesShipments).set({ status: 'SHIPPED' }).where(eq(salesShipments.id, shipmentId));

    const allLines = await tx.select({ quantity: salesOrderLines.quantity, shippedQuantity: salesOrderLines.shippedQuantity }).from(salesOrderLines).where(eq(salesOrderLines.orderId, shipment.orderId));
    const fullyShipped = allLines.every((l) => money(l.shippedQuantity).greaterThanOrEqualTo(l.quantity));
    await tx.update(salesOrders).set({ status: fullyShipped ? 'SHIPPED' : 'IN_FULFILLMENT' }).where(eq(salesOrders.id, shipment.orderId));
  });
}

export async function markShipmentDelivered(companyId: string, shipmentId: string): Promise<void> {
  const [shipment] = await db.select({ status: salesShipments.status }).from(salesShipments).where(and(eq(salesShipments.id, shipmentId), eq(salesShipments.companyId, companyId))).limit(1);
  if (!shipment) throw new SalesError('Sevkiyat bulunamadı.');
  if (shipment.status !== 'SHIPPED') throw new SalesError('Yalnızca gönderilmiş (SHIPPED) bir sevkiyat teslim edildi olarak işaretlenebilir.');
  await db.update(salesShipments).set({ status: 'DELIVERED' }).where(eq(salesShipments.id, shipmentId));
}
