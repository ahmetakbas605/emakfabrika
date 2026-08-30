import 'server-only';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import {
  mrpRuns, mrpPlannedOrders, salesOrders, salesOrderLines, stockItems, invBalances, productionOrders,
  boms, bomLines, products, warehouses, procPoLines, procPos, procAwardLines, procRfqLines, procTenderLines, procReceipts, procReceiptLines
} from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { getActiveBom } from '@/lib/production/bom';
import { MrpError } from './errors';

// Holding ERP Faz 3 — MRP motoru (madde 19'un 5 girdisi, Tahmin/Forecast
// HARİÇ — schema.ts'in kendi yorumu, sıfır veriyle anlamlı tahmin
// hesaplanamaz). ÇOK SEVİYELİ BOM patlatması: bir mamul için önerilen
// üretim, KENDİ bileşenleri için bir SONRAKİ seviyede yeni talep satırları
// üretir (parentId ile izlenebilir) — bu, gerçek bir MRP'yi basit bir
// "eksik stok raporu"ndan ayıran temel özellik.
//
// ÇOKLU-ÜST (multiple parent) izlenebilirlik KASITLI OLARAK basitleştirildi:
// aynı ürün birden fazla üst emirden talep görürse, TÜM miktarlar TEK bir
// önerilen emirde toplanır (gerçek MRP'nin yaptığı gibi — aynı bileşeni iki
// kez sipariş etmemek için), ama parentId yalnızca İLK katkı sağlayan üst
// emri işaret eder (tam çoklu-ata izlenebilirliği "pegging" tablosu
// gerektirir — bu, standart maliyetlendirme gibi, ayrı bir gelecek fazın
// konusu, TODO not edildi).

const MAX_EXPLOSION_DEPTH = 10;

interface DemandLine {
  productId: string;
  quantity: ReturnType<typeof money>;
  demandSource: (typeof mrpPlannedOrders.$inferInsert)['demandSource'];
  parentId: string | null;
}

async function getOnHandQty(tx: Tx, companyId: string, warehouseId: string, productId: string): Promise<ReturnType<typeof money>> {
  const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, productId), eq(stockItems.companyId, companyId))).limit(1);
  if (!stockItem) return money(0);
  const [balance] = await tx.select({ qty: invBalances.qty }).from(invBalances).where(and(eq(invBalances.warehouseId, warehouseId), eq(invBalances.stockItemId, stockItem.id))).limit(1);
  return balance ? money(balance.qty) : money(0);
}

// madde 19 "Açık Üretim" — RELEASED/IN_PROGRESS durumundaki üretim
// emirlerinin HENÜZ ÜRETİLMEMİŞ (quantity - goodQuantity) kısmı.
async function getScheduledProductionQty(tx: Tx, companyId: string, warehouseId: string, productId: string): Promise<ReturnType<typeof money>> {
  const rows = await tx
    .select({ quantity: productionOrders.quantity, goodQuantity: productionOrders.goodQuantity })
    .from(productionOrders)
    .where(and(eq(productionOrders.companyId, companyId), eq(productionOrders.warehouseId, warehouseId), eq(productionOrders.productId, productId), inArray(productionOrders.status, ['RELEASED', 'IN_PROGRESS'])));
  return rows.reduce((acc, r) => acc.plus(money(r.quantity).minus(r.goodQuantity)), money(0));
}

// madde 19 "Açık Satın Alma" — ISSUED/ACKNOWLEDGED bir PO'nun HENÜZ mal
// kabulü yapılmamış kısmı. procPoLines'ın kendisinde productId YOK (award/
// RFQ/tender zincirinden gelir — procurement/award.ts:createAward'ın kendi
// tasarımı) — bu yüzden procAwardLines üzerinden procRfqLines/
// procTenderLines'a (ikisi de kendi productId'sini taşıyor) LEFT JOIN.
async function getOpenPurchaseOrderQty(tx: Tx, companyId: string, productId: string): Promise<ReturnType<typeof money>> {
  const lines = await tx
    .select({ id: procPoLines.id, quantity: procPoLines.quantity, rfqProductId: procRfqLines.productId, tenderProductId: procTenderLines.productId })
    .from(procPoLines)
    .innerJoin(procPos, eq(procPos.id, procPoLines.poId))
    .innerJoin(procAwardLines, eq(procAwardLines.id, procPoLines.awardLineId))
    .leftJoin(procRfqLines, eq(procRfqLines.id, procAwardLines.rfqLineId))
    .leftJoin(procTenderLines, eq(procTenderLines.id, procAwardLines.tenderLineId))
    .where(and(eq(procPos.companyId, companyId), inArray(procPos.status, ['ISSUED', 'ACKNOWLEDGED'])));

  const matchingLines = lines.filter((l) => l.rfqProductId === productId || l.tenderProductId === productId);
  if (matchingLines.length === 0) return money(0);

  const poLineIds = matchingLines.map((l) => l.id);
  const receipts = await tx
    .select({ poLineId: procReceiptLines.poLineId, receivedQty: procReceiptLines.receivedQty })
    .from(procReceiptLines)
    .innerJoin(procReceipts, eq(procReceipts.id, procReceiptLines.receiptId))
    .where(and(eq(procReceipts.companyId, companyId), inArray(procReceiptLines.poLineId, poLineIds)));

  const receivedByLine = new Map<string, ReturnType<typeof money>>();
  for (const r of receipts) receivedByLine.set(r.poLineId, (receivedByLine.get(r.poLineId) ?? money(0)).plus(r.receivedQty));

  return matchingLines.reduce((acc, l) => {
    const received = receivedByLine.get(l.id) ?? money(0);
    const remaining = money(l.quantity).minus(received);
    return remaining.greaterThan(0) ? acc.plus(remaining) : acc;
  }, money(0));
}

function groupByProduct(lines: DemandLine[]): Map<string, DemandLine> {
  const grouped = new Map<string, DemandLine>();
  for (const line of lines) {
    const existing = grouped.get(line.productId);
    if (existing) {
      existing.quantity = existing.quantity.plus(line.quantity);
    } else {
      grouped.set(line.productId, { ...line });
    }
  }
  return grouped;
}

export async function runMrp(companyId: string, createdByUserId: string, warehouseId: string, runDate: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.companyId, companyId))).limit(1);
    if (!warehouse) throw new MrpError('Depo bulunamadı.');

    const mrpRunId = newId();
    await tx.insert(mrpRuns).values({ id: mrpRunId, companyId, warehouseId, runDate, createdByUserId });

    try {
      // --- Seviye 0: Satış talebi + Minimum stok ---
      const salesLines = await tx
        .select({ productId: salesOrderLines.productId, quantity: salesOrderLines.quantity, shippedQuantity: salesOrderLines.shippedQuantity })
        .from(salesOrderLines)
        .innerJoin(salesOrders, eq(salesOrders.id, salesOrderLines.orderId))
        .where(and(eq(salesOrders.companyId, companyId), inArray(salesOrders.status, ['CONFIRMED', 'IN_FULFILLMENT'])));

      let queue: DemandLine[] = [];
      for (const line of salesLines) {
        const remaining = money(line.quantity).minus(line.shippedQuantity);
        if (remaining.greaterThan(0)) queue.push({ productId: line.productId, quantity: remaining, demandSource: 'SALES_ORDER', parentId: null });
      }

      const itemsWithMin = await tx.select({ id: stockItems.id, productId: stockItems.productId, minQty: stockItems.minQty }).from(stockItems).where(and(eq(stockItems.companyId, companyId), isNotNull(stockItems.minQty)));
      for (const item of itemsWithMin) {
        if (!item.productId) continue; // MRP yalnızca Master Data'ya bağlı ürünler için planlanabilir
        const [balance] = await tx.select({ qty: invBalances.qty }).from(invBalances).where(and(eq(invBalances.warehouseId, warehouseId), eq(invBalances.stockItemId, item.id))).limit(1);
        const onHand = balance ? money(balance.qty) : money(0);
        const shortfall = money(item.minQty!).minus(onHand);
        if (shortfall.greaterThan(0)) queue.push({ productId: item.productId, quantity: shortfall, demandSource: 'MIN_STOCK', parentId: null });
      }

      // GERÇEK bir çok-seviyeli MRP inceliği: aynı ürün BİRDEN FAZLA seviyede
      // talep görebilir (ör. hem kendi minimum-stok politikası VAR hem de
      // başka bir mamulün bileşeni) — her seviyede on-hand/açık-sipariş'i
      // SIFIRDAN sorgulamak, AYNI mevcut stoğu iki kez "kredilendirir" ve
      // toplamda EKSİK sipariş önerir. Bunu önlemek için her ürünün
      // kullanılabilir arzı (on-hand + açık üretim + açık satın alma) TEK
      // SEFER hesaplanıp bu koşu boyunca TÜKETİLDİKÇE azaltılan bir havuzda
      // tutulur (gerçek MRP'lerin "low-level coding" ile çözdüğü sorunun,
      // bu ölçekte yeterli, daha basit bir eşdeğeri).
      const remainingSupply = new Map<string, ReturnType<typeof money>>();
      async function consumeSupply(productId: string, grossQty: ReturnType<typeof money>): Promise<ReturnType<typeof money>> {
        if (!remainingSupply.has(productId)) {
          const onHand = await getOnHandQty(tx, companyId, warehouseId, productId);
          const scheduledProduction = await getScheduledProductionQty(tx, companyId, warehouseId, productId);
          const scheduledPurchase = await getOpenPurchaseOrderQty(tx, companyId, productId);
          remainingSupply.set(productId, onHand.plus(scheduledProduction).plus(scheduledPurchase));
        }
        const available = remainingSupply.get(productId)!;
        const availableNonNegative = available.greaterThan(0) ? available : money(0);
        const consumed = availableNonNegative.lessThan(grossQty) ? availableNonNegative : grossQty;
        remainingSupply.set(productId, available.minus(consumed));
        return grossQty.minus(consumed);
      }

      let depth = 0;
      while (queue.length > 0) {
        depth++;
        if (depth > MAX_EXPLOSION_DEPTH) throw new MrpError(`BOM patlatması ${MAX_EXPLOSION_DEPTH} seviyeyi aştı — dolaylı bir döngüsel BOM olabilir.`);

        const grouped = groupByProduct(queue);
        queue = [];

        for (const demand of grouped.values()) {
          const [product] = await tx.select({ id: products.id, baseUnitId: products.baseUnitId }).from(products).where(and(eq(products.id, demand.productId), eq(products.companyId, companyId))).limit(1);
          if (!product) continue;

          const netRequirement = await consumeSupply(demand.productId, demand.quantity);
          if (netRequirement.lessThanOrEqualTo(0)) continue;

          const bom = await getActiveBom(companyId, demand.productId);
          const orderType: (typeof mrpPlannedOrders.$inferInsert)['orderType'] = bom ? 'PRODUCTION' : 'PURCHASE';

          const plannedOrderId = newId();
          await tx.insert(mrpPlannedOrders).values({
            id: plannedOrderId, mrpRunId, companyId, productId: demand.productId, quantity: toDb(netRequirement), unitId: product.baseUnitId,
            warehouseId, orderType, demandSource: demand.demandSource, parentId: demand.parentId
          });

          if (bom) {
            const lines = await tx.select().from(bomLines).where(eq(bomLines.bomId, bom.id));
            const scaleFactor = netRequirement.dividedBy(money(bom.baseQuantity));
            for (const line of lines) {
              const grossQty = money(line.quantity).times(scaleFactor);
              const requiredQty = line.scrapPercent ? grossQty.times(money(1).plus(money(line.scrapPercent).dividedBy(100))) : grossQty;
              queue.push({ productId: line.componentProductId, quantity: requiredQty, demandSource: 'BOM_EXPLOSION', parentId: plannedOrderId });
            }
          }
        }
      }

      await tx.update(mrpRuns).set({ status: 'COMPLETED', completedAt: new Date() }).where(eq(mrpRuns.id, mrpRunId));
      return mrpRunId;
    } catch (err) {
      await tx.update(mrpRuns).set({ status: 'FAILED', completedAt: new Date() }).where(eq(mrpRuns.id, mrpRunId));
      throw err;
    }
  });
}

export async function listMrpRuns(companyId: string) {
  return db.select().from(mrpRuns).where(eq(mrpRuns.companyId, companyId)).orderBy(mrpRuns.createdAt);
}

export async function getMrpRun(companyId: string, mrpRunId: string) {
  const [run] = await db.select().from(mrpRuns).where(and(eq(mrpRuns.id, mrpRunId), eq(mrpRuns.companyId, companyId))).limit(1);
  if (!run) throw new MrpError('MRP koşusu bulunamadı.');
  const plannedOrders = await db
    .select({
      id: mrpPlannedOrders.id, productId: mrpPlannedOrders.productId, productName: products.name, productSku: products.sku,
      quantity: mrpPlannedOrders.quantity, orderType: mrpPlannedOrders.orderType, status: mrpPlannedOrders.status,
      demandSource: mrpPlannedOrders.demandSource, parentId: mrpPlannedOrders.parentId, convertedOrderType: mrpPlannedOrders.convertedOrderType,
      convertedOrderId: mrpPlannedOrders.convertedOrderId, warehouseId: mrpPlannedOrders.warehouseId, unitId: mrpPlannedOrders.unitId
    })
    .from(mrpPlannedOrders)
    .innerJoin(products, eq(products.id, mrpPlannedOrders.productId))
    .where(eq(mrpPlannedOrders.mrpRunId, mrpRunId));
  return { run, plannedOrders };
}

export async function cancelPlannedOrder(companyId: string, plannedOrderId: string): Promise<void> {
  const [row] = await db.select({ id: mrpPlannedOrders.id, status: mrpPlannedOrders.status }).from(mrpPlannedOrders).where(and(eq(mrpPlannedOrders.id, plannedOrderId), eq(mrpPlannedOrders.companyId, companyId))).limit(1);
  if (!row) throw new MrpError('Önerilen emir bulunamadı.');
  if (row.status !== 'SUGGESTED') throw new MrpError('Yalnızca önerilen (SUGGESTED) bir kalem iptal edilebilir.');
  await db.update(mrpPlannedOrders).set({ status: 'CANCELLED' }).where(eq(mrpPlannedOrders.id, plannedOrderId));
}
