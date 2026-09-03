import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { salesOrders, salesOrderLines, salesQuotes, salesQuoteLines, parties, products, stockItems, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { reserveStockInTx } from '@/lib/warehouse';
import { markQuoteConvertedInTx } from './quotes';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Sipariş (Sales Order). lib/hr/bonus.ts:actOnBonusStep
// İLE BİREBİR AYNI create-draft→submit→jenerik-workflow deseni
// (documentType='SALES_ORDER', workflow/engine.ts SIFIR değişti).

export interface OrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRatePercent?: number;
}

export interface CreateOrderInput {
  partyId: string;
  orderDate: string;
  currencyCode: string;
  lines: OrderLineInput[];
}

function computeLineTotal(quantity: number | string, unitPrice: number | string, discountPercent?: number | string | null): ReturnType<typeof money> {
  const gross = money(quantity).times(unitPrice);
  const discount = discountPercent ? gross.times(discountPercent).dividedBy(100) : money(0);
  return gross.minus(discount);
}

export async function createOrder(companyId: string, createdByUserId: string, input: CreateOrderInput): Promise<string> {
  if (input.lines.length === 0) throw new SalesError('Siparişte en az bir kalem olmalı.');

  return db.transaction(async (tx) => {
    const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.partyId), eq(parties.companyId, companyId))).limit(1);
    if (!party) throw new SalesError('Cari kartı bulunamadı.');

    const id = newId();
    const orderNo = await nextDocumentNo(tx, companyId, 'SLSO', 'SIP', new Date().getFullYear(), 6);
    await tx.insert(salesOrders).values({ id, companyId, orderNo, partyId: input.partyId, orderDate: input.orderDate, currencyCode: input.currencyCode, createdByUserId });

    for (const line of input.lines) {
      const [product] = await tx.select({ id: products.id, taxRatePercent: products.taxRatePercent }).from(products).where(and(eq(products.id, line.productId), eq(products.companyId, companyId))).limit(1);
      if (!product) throw new SalesError('Ürün bulunamadı.');
      await tx.insert(salesOrderLines).values({
        id: newId(), orderId: id, productId: line.productId, quantity: toDb(line.quantity), unitPrice: toDb(line.unitPrice),
        discountPercent: line.discountPercent === undefined ? undefined : toDb(line.discountPercent),
        taxRatePercent: toDb(line.taxRatePercent ?? product.taxRatePercent ?? 0),
        lineTotal: toDb(computeLineTotal(line.quantity, line.unitPrice, line.discountPercent))
      });
    }

    return id;
  });
}

// madde (Teklif → Sipariş) — kabul edilmiş bir teklifin satırlarını AYNEN
// kopyalar, teklifi CONVERTED'a çevirir. TEK transaction (quotes.ts:
// markQuoteConvertedInTx).
export async function createOrderFromQuote(companyId: string, createdByUserId: string, quoteId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(salesQuotes).where(and(eq(salesQuotes.id, quoteId), eq(salesQuotes.companyId, companyId))).limit(1);
    if (!quote) throw new SalesError('Teklif bulunamadı.');
    const lines = await tx.select().from(salesQuoteLines).where(eq(salesQuoteLines.quoteId, quoteId));
    if (lines.length === 0) throw new SalesError('Teklifte kalem yok.');

    await markQuoteConvertedInTx(tx, companyId, quoteId);

    const id = newId();
    const orderNo = await nextDocumentNo(tx, companyId, 'SLSO', 'SIP', new Date().getFullYear(), 6);
    await tx.insert(salesOrders).values({ id, companyId, orderNo, partyId: quote.partyId, quoteId, orderDate: quote.quoteDate, currencyCode: quote.currencyCode, createdByUserId });

    for (const line of lines) {
      await tx.insert(salesOrderLines).values({
        id: newId(), orderId: id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice,
        discountPercent: line.discountPercent, taxRatePercent: line.taxRatePercent, lineTotal: line.lineTotal
      });
    }

    return id;
  });
}

export async function listOrders(companyId: string, partyId?: string) {
  const conditions = partyId ? and(eq(salesOrders.companyId, companyId), eq(salesOrders.partyId, partyId)) : eq(salesOrders.companyId, companyId);
  return db
    .select({ id: salesOrders.id, orderNo: salesOrders.orderNo, partyId: salesOrders.partyId, partyName: parties.legalName, orderDate: salesOrders.orderDate, status: salesOrders.status, currencyCode: salesOrders.currencyCode, createdAt: salesOrders.createdAt })
    .from(salesOrders)
    .innerJoin(parties, eq(parties.id, salesOrders.partyId))
    .where(conditions)
    .orderBy(desc(salesOrders.createdAt));
}

export async function getOrder(companyId: string, orderId: string) {
  const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, orderId), eq(salesOrders.companyId, companyId))).limit(1);
  if (!order) throw new SalesError('Sipariş bulunamadı.');
  const lines = await db
    .select({ id: salesOrderLines.id, productId: salesOrderLines.productId, productName: products.name, quantity: salesOrderLines.quantity, unitPrice: salesOrderLines.unitPrice, discountPercent: salesOrderLines.discountPercent, taxRatePercent: salesOrderLines.taxRatePercent, lineTotal: salesOrderLines.lineTotal, shippedQuantity: salesOrderLines.shippedQuantity, invoicedQuantity: salesOrderLines.invoicedQuantity })
    .from(salesOrderLines)
    .innerJoin(products, eq(products.id, salesOrderLines.productId))
    .where(eq(salesOrderLines.orderId, orderId));
  return { order, lines };
}

export async function cancelOrder(companyId: string, orderId: string, userId: string): Promise<void> {
  const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, orderId), eq(salesOrders.companyId, companyId))).limit(1);
  if (!order) throw new SalesError('Sipariş bulunamadı.');
  if (order.status !== 'DRAFT' && order.status !== 'REVISION_REQUIRED') throw new SalesError(`${order.status} durumundaki bir sipariş iptal edilemez.`);
  if (order.createdByUserId !== userId) throw new SalesError('Yalnızca siparişi oluşturan kişi iptal edebilir.');
  await db.update(salesOrders).set({ status: 'CANCELLED' }).where(eq(salesOrders.id, orderId));
}

export async function submitOrder(companyId: string, orderId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(salesOrders).where(and(eq(salesOrders.id, orderId), eq(salesOrders.companyId, companyId))).limit(1);
    if (!order) throw new SalesError('Sipariş bulunamadı.');
    if (order.status !== 'DRAFT' && order.status !== 'REVISION_REQUIRED') throw new SalesError(`${order.status} durumundaki bir sipariş gönderilemez.`);

    const lines = await tx.select({ lineTotal: salesOrderLines.lineTotal }).from(salesOrderLines).where(eq(salesOrderLines.orderId, orderId));
    const total = lines.reduce((acc, l) => acc.plus(money(l.lineTotal)), money(0));

    await startApprovalInTx(tx, companyId, 'SALES_ORDER', orderId, userId, { amount: total.toNumber() });
    await tx.update(salesOrders).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(salesOrders.id, orderId));
  });
}

export interface ActOnOrderStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
  // Yalnızca decision=APPROVE'da, OPSİYONEL stok rezervasyonu için — boşsa
  // sipariş stoktan BAĞIMSIZ onaylanır (recordStockMovement'ın
  // counterAccountCode'u İLE AYNI "opsiyonel entegrasyon, hiçbir şeyi
  // ZORUNLU olarak bloklamaz" ilkesi — ANCAK doluysa VE yetersiz stok varsa,
  // burada BİLEREK farklı davranılır: onay reddedilir, çünkü stok burada
  // muhasebe kaydı gibi bir yan etki değil, gerçek bir iş kısıtı — "olmayan
  // malı satma" senaryosunu sessizce onaylamak yanlış olur).
  warehouseId?: string;
}

export async function actOnOrderStep(companyId: string, input: ActOnOrderStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new SalesError('Onay adımı bulunamadı.');
    // Güvenlik denetimi 2026-09-03, bulgu 2.7 — companyId filtresi eklendi.
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
    if (!instance || instance.documentType !== 'SALES_ORDER') throw new SalesError('Bu adım bir satış siparişine ait değil.');
    const orderId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      if (input.warehouseId) {
        const lines = await tx.select({ productId: salesOrderLines.productId, quantity: salesOrderLines.quantity }).from(salesOrderLines).where(eq(salesOrderLines.orderId, orderId));
        for (const line of lines) {
          const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, line.productId), eq(stockItems.companyId, companyId))).limit(1);
          if (stockItem) {
            await reserveStockInTx(tx, companyId, { warehouseId: input.warehouseId, stockItemId: stockItem.id, quantity: line.quantity, sourceType: 'SALES_ORDER', sourceId: orderId, createdByUserId: input.actingUserId });
          }
        }
      }
      await tx.update(salesOrders).set({ status: 'CONFIRMED', confirmedAt: new Date() }).where(eq(salesOrders.id, orderId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(salesOrders).set({ status: newStatus }).where(eq(salesOrders.id, orderId));
  });
}
