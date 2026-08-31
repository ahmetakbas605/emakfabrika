import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { productionOrders, boms, bomLines, prodOperations, stockItems, invReservations } from '@/db/schema';
import { money, toDb } from '@/lib/money';
import { recordStockMovementInTx, releaseReservationInTx } from '@/lib/warehouse';
import { ProductionError } from './errors';

// Holding ERP Faz 2 — Malzeme Çıkışı → Üretim → Mamul. lib/sales/shipments.ts
// İLE AYNI "opsiyonel stok entegrasyonu" (ürün-stok kartı eşleşmesi yoksa
// hareket atlanır) + lib/sales/invoices.ts İLE AYNI "opsiyonel muhasebe
// entegrasyonu" (yalnızca hesap kodu verilirse fiş üretir) desenleri.

export interface IssueProductionMaterialsInput {
  transactionDate: string;
  counterAccountCode?: string; // opsiyonel — WIP/Yarı Mamul hesabı
}

// madde (Malzeme Çıkışı) — TEK, TAM tüketim olayı (Satış Sevkiyatı'nın
// AKSİNE kısmi/çoklu malzeme çıkışı bu fazda desteklenmiyor — bilinçli bir
// basitleştirme, gerçek ihtiyaç doğarsa genişletilir). Bu YÜZDEN, Sevkiyat'ın
// belgelediği "rezervasyon serbest bırakma" sınırlaması burada YOK — tam
// tüketim olduğu için approve-time rezervasyonu burada GERÇEKTEN serbest
// bırakılır (releaseReservationInTx).
export async function issueProductionMaterials(companyId: string, orderId: string, userId: string, input: IssueProductionMaterialsInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(productionOrders).where(and(eq(productionOrders.id, orderId), eq(productionOrders.companyId, companyId))).limit(1);
    if (!order) throw new ProductionError('Üretim emri bulunamadı.');
    if (order.status !== 'RELEASED' && order.status !== 'IN_PROGRESS') throw new ProductionError('Yalnızca serbest bırakılmış (RELEASED) bir üretim emri için malzeme çıkışı yapılabilir.');
    if (order.materialsIssuedAt) throw new ProductionError('Bu üretim emri için malzeme çıkışı zaten yapıldı.');

    const lines = await tx.select().from(bomLines).where(eq(bomLines.bomId, order.bomId));
    const [bom] = await tx.select({ baseQuantity: boms.baseQuantity }).from(boms).where(eq(boms.id, order.bomId)).limit(1);
    const scaleFactor = money(order.quantity).dividedBy(money(bom!.baseQuantity));

    for (const line of lines) {
      const grossQty = money(line.quantity).times(scaleFactor);
      const requiredQty = line.scrapPercent ? grossQty.times(money(1).plus(money(line.scrapPercent).dividedBy(100))) : grossQty;

      const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, line.componentProductId), eq(stockItems.companyId, companyId))).limit(1);
      if (!stockItem) continue;

      await recordStockMovementInTx(tx, {
        companyId, warehouseId: order.warehouseId, stockItemId: stockItem.id, movementType: 'OUT', quantity: toDb(requiredQty),
        counterAccountCode: input.counterAccountCode, transactionDate: input.transactionDate, sourceType: 'PRODUCTION_ORDER', sourceId: orderId,
        description: `Üretim emri malzeme çıkışı — ${order.orderNo}`, createdByUserId: userId
      });

      const activeReservations = await tx.select({ id: invReservations.id }).from(invReservations).where(and(eq(invReservations.sourceType, 'PRODUCTION_ORDER'), eq(invReservations.sourceId, orderId), eq(invReservations.stockItemId, stockItem.id), eq(invReservations.status, 'ACTIVE')));
      for (const reservation of activeReservations) {
        await releaseReservationInTx(tx, companyId, reservation.id);
      }
    }

    await tx.update(productionOrders).set({ materialsIssuedAt: new Date(), status: 'IN_PROGRESS' }).where(eq(productionOrders.id, orderId));
  });
}

export async function listProdOperations(companyId: string, orderId: string) {
  return db.select().from(prodOperations).where(and(eq(prodOperations.companyId, companyId), eq(prodOperations.orderId, orderId))).orderBy(prodOperations.operationOrder);
}

// Holding ERP Faz 4 (MES) — machineId OPSİYONEL, GERİYE UYUMLU eklendi
// (Faz 2'nin imzasına yeni bir zorunlu alan EKLENMEDİ). Operatör hangi
// makinede çalıştığını başlatma ANINDA seçer — OEE hesabı (lib/mes/oee.ts)
// bu alan dolu olmadan çalışamaz, ama doldurulması ZORUNLU değil (makine
// takibi istemeyen bir şirket Faz 2'nin eski davranışını aynen korur).
export async function startProdOperation(companyId: string, operationId: string, userId: string, machineId?: string): Promise<void> {
  const [op] = await db.select().from(prodOperations).where(and(eq(prodOperations.id, operationId), eq(prodOperations.companyId, companyId))).limit(1);
  if (!op) throw new ProductionError('Operasyon bulunamadı.');
  if (op.status !== 'PENDING') throw new ProductionError('Yalnızca bekleyen (PENDING) bir operasyon başlatılabilir.');
  await db.update(prodOperations).set({ status: 'IN_PROGRESS', startedAt: new Date(), assignedToUserId: userId, machineId }).where(eq(prodOperations.id, operationId));
}

export interface CompleteProdOperationInput {
  goodQuantity: number;
  scrapQuantity?: number;
}

export async function completeProdOperation(companyId: string, operationId: string, input: CompleteProdOperationInput): Promise<void> {
  const [op] = await db.select().from(prodOperations).where(and(eq(prodOperations.id, operationId), eq(prodOperations.companyId, companyId))).limit(1);
  if (!op) throw new ProductionError('Operasyon bulunamadı.');
  if (op.status !== 'IN_PROGRESS') throw new ProductionError('Yalnızca devam eden (IN_PROGRESS) bir operasyon tamamlanabilir.');
  await db.update(prodOperations).set({ status: 'COMPLETED', completedAt: new Date(), goodQuantity: toDb(input.goodQuantity), scrapQuantity: toDb(input.scrapQuantity ?? 0) }).where(eq(prodOperations.id, operationId));
}

export interface CompleteProductionOrderInput {
  goodQuantity: number;
  scrapQuantity?: number;
  transactionDate: string;
  unitCost?: number; // opsiyonel — verilmezse 0 (gerçek maliyetlendirme ayrı bir konu, TODO ileride)
  counterAccountCode?: string;
}

// madde (Üretim → Mamul) — mamul stoğa GİRİŞ. Operasyonların (varsa) TAMAMI
// tamamlanmadan (ya da hiç operasyon yoksa doğrudan) çağrılamaz — "iş emri
// hâlâ devam ederken mamul stoğa girdi" tutarsızlığını engeller.
export async function completeProductionOrder(companyId: string, orderId: string, userId: string, input: CompleteProductionOrderInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(productionOrders).where(and(eq(productionOrders.id, orderId), eq(productionOrders.companyId, companyId))).limit(1);
    if (!order) throw new ProductionError('Üretim emri bulunamadı.');
    if (order.status !== 'IN_PROGRESS') throw new ProductionError('Yalnızca devam eden (IN_PROGRESS) bir üretim emri tamamlanabilir.');
    if (!order.materialsIssuedAt) throw new ProductionError('Önce malzeme çıkışı yapılmalı.');
    if (input.goodQuantity < 0 || (input.scrapQuantity ?? 0) < 0) throw new ProductionError('Miktarlar negatif olamaz.');

    const openOperations = await tx.select({ id: prodOperations.id }).from(prodOperations).where(and(eq(prodOperations.orderId, orderId), eq(prodOperations.status, 'PENDING')));
    const inProgressOperations = await tx.select({ id: prodOperations.id }).from(prodOperations).where(and(eq(prodOperations.orderId, orderId), eq(prodOperations.status, 'IN_PROGRESS')));
    if (openOperations.length > 0 || inProgressOperations.length > 0) throw new ProductionError('Tüm iş emri operasyonları tamamlanmadan üretim emri kapatılamaz.');

    if (input.goodQuantity > 0) {
      const [stockItem] = await tx.select({ id: stockItems.id }).from(stockItems).where(and(eq(stockItems.productId, order.productId), eq(stockItems.companyId, companyId))).limit(1);
      if (stockItem) {
        await recordStockMovementInTx(tx, {
          companyId, warehouseId: order.warehouseId, stockItemId: stockItem.id, movementType: 'IN', quantity: input.goodQuantity, unitCost: input.unitCost ?? 0,
          counterAccountCode: input.counterAccountCode, transactionDate: input.transactionDate, sourceType: 'PRODUCTION_ORDER', sourceId: orderId,
          description: `Üretim emri mamul girişi — ${order.orderNo}`, createdByUserId: userId
        });
      }
    }

    await tx.update(productionOrders).set({ goodQuantity: toDb(input.goodQuantity), scrapQuantity: toDb(input.scrapQuantity ?? 0), status: 'COMPLETED', completedAt: new Date() }).where(eq(productionOrders.id, orderId));
  });
}
