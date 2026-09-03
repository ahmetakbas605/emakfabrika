import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { productionOrders, boms, bomLines, routings, routingOperations, prodOperations, products, warehouses, stockItems, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { startApprovalInTx, actOnStepInTx, type ApprovalDecision } from '@/lib/workflow/engine';
import { reserveStockInTx } from '@/lib/warehouse';
import { getActiveBom } from './bom';
import { getActiveRouting } from './routing';
import { ProductionError } from './errors';

// Holding ERP Faz 2 — Üretim Emri. lib/sales/orders.ts:createOrder/submitOrder/
// actOnOrderStep İLE AYNI create-draft→submit→jenerik-workflow deseni
// (documentType='PRODUCTION_ORDER', workflow/engine.ts SIFIR değişti).

export interface CreateProductionOrderInput {
  productId: string;
  quantity: number;
  unitId: string;
  warehouseId: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  salesOrderId?: string;
}

// madde (BOM çözümleme) — üretim emri her zaman ürünün O ANDA ACTIVE BOM'unu
// kullanır, çağıran taraf bir versiyon SEÇEMEZ (bom.ts:getActiveBom'un
// kendi yorumu). Routing OPSİYONEL — yoksa iş emri üretilmez, üretim emri
// yine de malzeme çıkışı→tamamlama akışıyla ilerleyebilir.
export async function createProductionOrder(companyId: string, createdByUserId: string, input: CreateProductionOrderInput): Promise<string> {
  if (input.quantity <= 0) throw new ProductionError('Miktar 0\'dan büyük olmalı.');

  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.companyId, companyId))).limit(1);
    if (!product) throw new ProductionError('Ürün bulunamadı.');
    const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.companyId, companyId))).limit(1);
    if (!warehouse) throw new ProductionError('Depo bulunamadı.');

    const bom = await getActiveBom(companyId, input.productId);
    if (!bom) throw new ProductionError('Bu ürün için geçerli (ACTIVE) bir BOM tanımlı değil — önce bir BOM oluşturulmalı.');
    const routing = await getActiveRouting(companyId, input.productId);

    const id = newId();
    const orderNo = await nextDocumentNo(tx, companyId, 'PRODORDER', 'URT', new Date().getFullYear(), 6);
    await tx.insert(productionOrders).values({
      id, companyId, orderNo, productId: input.productId, bomId: bom.id, routingId: routing?.id, quantity: toDb(input.quantity), unitId: input.unitId,
      warehouseId: input.warehouseId, plannedStartDate: input.plannedStartDate, plannedEndDate: input.plannedEndDate, salesOrderId: input.salesOrderId, createdByUserId
    });
    return id;
  });
}

export async function listProductionOrders(companyId: string) {
  return db
    .select({ id: productionOrders.id, orderNo: productionOrders.orderNo, productId: productionOrders.productId, productName: products.name, quantity: productionOrders.quantity, status: productionOrders.status, plannedStartDate: productionOrders.plannedStartDate, createdAt: productionOrders.createdAt })
    .from(productionOrders)
    .innerJoin(products, eq(products.id, productionOrders.productId))
    .where(eq(productionOrders.companyId, companyId))
    .orderBy(desc(productionOrders.createdAt));
}

export async function getProductionOrder(companyId: string, orderId: string) {
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, orderId), eq(productionOrders.companyId, companyId))).limit(1);
  if (!order) throw new ProductionError('Üretim emri bulunamadı.');
  const [bom] = await db.select().from(boms).where(eq(boms.id, order.bomId)).limit(1);
  const routing = order.routingId ? (await db.select().from(routings).where(eq(routings.id, order.routingId)).limit(1))[0] : null;
  const operations = await db.select().from(prodOperations).where(eq(prodOperations.orderId, orderId)).orderBy(prodOperations.operationOrder);
  return { order, bom, routing: routing ?? null, operations };
}

export async function cancelProductionOrder(companyId: string, orderId: string, userId: string): Promise<void> {
  const [order] = await db.select().from(productionOrders).where(and(eq(productionOrders.id, orderId), eq(productionOrders.companyId, companyId))).limit(1);
  if (!order) throw new ProductionError('Üretim emri bulunamadı.');
  if (order.status !== 'DRAFT' && order.status !== 'REVISION_REQUIRED') throw new ProductionError(`${order.status} durumundaki bir üretim emri iptal edilemez.`);
  if (order.createdByUserId !== userId) throw new ProductionError('Yalnızca üretim emrini oluşturan kişi iptal edebilir.');
  await db.update(productionOrders).set({ status: 'CANCELLED' }).where(eq(productionOrders.id, orderId));
}

// madde (Onay eşiği) — WorkflowContext'in "amount" alanı için gerçek bir
// maliyet hesabı (ürün maliyeti × miktar) bu fazın kapsamı DIŞINDA
// (standart/gerçek maliyetlendirme ayrı, büyük bir konu — TODO ileride);
// bu yüzden burada MİKTAR kendisi eşik değeri olarak kullanılıyor — bir
// şirket "1000 adetin üzerindeki üretim emirleri onay gerektirir" gibi bir
// kural tanımlayabilir, tutar-bazlı bir kural İSTERSE ileride eklenecek.
export async function submitProductionOrder(companyId: string, orderId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(productionOrders).where(and(eq(productionOrders.id, orderId), eq(productionOrders.companyId, companyId))).limit(1);
    if (!order) throw new ProductionError('Üretim emri bulunamadı.');
    if (order.status !== 'DRAFT' && order.status !== 'REVISION_REQUIRED') throw new ProductionError(`${order.status} durumundaki bir üretim emri gönderilemez.`);

    await startApprovalInTx(tx, companyId, 'PRODUCTION_ORDER', orderId, userId, { amount: money(order.quantity).toNumber() });
    await tx.update(productionOrders).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(productionOrders.id, orderId));
  });
}

export interface ActOnProductionOrderStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

// madde (Onay → Serbest Bırakma). APPROVED olunca ÜÇ şey TEK transaction'da
// olur: (1) durum RELEASED, (2) routing varsa her operasyon için bir
// prod_operations satırı (PENDING) üretilir, (3) BOM bileşenleri o üretim
// emrinin (ZORUNLU) deposunda rezerve edilir — sales_orders'ın AKSİNE burada
// depo zaten emrin kendi alanı olduğu için (opsiyonel bir parametre
// GEREKMEZ), rezervasyon HER ZAMAN dener; eşleşen stok kartı yoksa (ürün-
// stok kartı bağlantısı opsiyonel, madde başındaki ilke) o bileşen İÇİN
// sessizce atlanır, zorlanmaz.
export async function actOnProductionOrderStep(companyId: string, input: ActOnProductionOrderStepInput): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new ProductionError('Onay adımı bulunamadı.');
    // Güvenlik denetimi 2026-09-03, bulgu 2.7 — companyId filtresi eklendi.
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
    if (!instance || instance.documentType !== 'PRODUCTION_ORDER') throw new ProductionError('Bu adım bir üretim emrine ait değil.');
    const orderId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    if (result.instanceStatus === 'APPROVED') {
      const [order] = await tx.select().from(productionOrders).where(eq(productionOrders.id, orderId)).limit(1);
      if (!order) throw new ProductionError('Üretim emri bulunamadı.');

      if (order.routingId) {
        const operations = await tx.select().from(routingOperations).where(eq(routingOperations.routingId, order.routingId)).orderBy(routingOperations.operationOrder);
        for (const op of operations) {
          await tx.insert(prodOperations).values({ id: newId(), companyId, orderId, routingOpId: op.id, operationOrder: op.operationOrder, workCenterId: op.workCenterId, name: op.name });
        }
      }

      const lines = await tx.select().from(bomLines).where(eq(bomLines.bomId, order.bomId));
      const [bom] = await tx.select({ baseQuantity: boms.baseQuantity }).from(boms).where(eq(boms.id, order.bomId)).limit(1);
      const scaleFactor = money(order.quantity).dividedBy(money(bom!.baseQuantity));
      for (const line of lines) {
        const grossQty = money(line.quantity).times(scaleFactor);
        const requiredQty = line.scrapPercent ? grossQty.times(money(1).plus(money(line.scrapPercent).dividedBy(100))) : grossQty;
        const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, line.componentProductId), eq(stockItems.companyId, companyId))).limit(1);
        if (stockItem) {
          await reserveStockInTx(tx, companyId, { warehouseId: order.warehouseId, stockItemId: stockItem.id, quantity: toDb(requiredQty), sourceType: 'PRODUCTION_ORDER', sourceId: orderId, createdByUserId: input.actingUserId });
        }
      }

      await tx.update(productionOrders).set({ status: 'RELEASED', releasedAt: new Date() }).where(eq(productionOrders.id, orderId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(productionOrders).set({ status: newStatus }).where(eq(productionOrders.id, orderId));
  });
}
