import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { procReceiptLines, procReceipts, procPos, procPoLines, parties, prodOperations, productionOrders, products } from '@/db/schema';

// Holding ERP Faz 5 (Kalite) — muayene kaydederken seçilecek "kaynak"
// listeleri. Her tip için AYRI bir tablo/FK AÇILMAK yerine
// quality_inspections.sourceType/sourceId'nin neyi gösterdiğini burada
// çözüyoruz (UI'ın seçim yapabilmesi için salt-okunur listeler, son 50
// kayıt — bu bir arşiv görünümü değil, "hangi kaydı muayene ediyorum"
// seçicisi).

export async function listIncomingInspectionSources(companyId: string) {
  return db
    .select({
      id: procReceiptLines.id, receiptNo: procReceipts.receiptNo, receiptDate: procReceipts.receiptDate,
      description: procPoLines.description, receivedQty: procReceiptLines.receivedQty, supplierName: parties.legalName
    })
    .from(procReceiptLines)
    .innerJoin(procReceipts, eq(procReceipts.id, procReceiptLines.receiptId))
    .innerJoin(procPoLines, eq(procPoLines.id, procReceiptLines.poLineId))
    .innerJoin(procPos, eq(procPos.id, procReceipts.poId))
    .innerJoin(parties, eq(parties.id, procPos.supplierPartyId))
    .where(eq(procReceipts.companyId, companyId))
    .orderBy(desc(procReceipts.receiptDate))
    .limit(50);
}

export async function listInProcessInspectionSources(companyId: string) {
  return db
    .select({
      id: prodOperations.id, name: prodOperations.name, orderNo: productionOrders.orderNo, productName: products.name, status: prodOperations.status
    })
    .from(prodOperations)
    .innerJoin(productionOrders, eq(productionOrders.id, prodOperations.orderId))
    .innerJoin(products, eq(products.id, productionOrders.productId))
    .where(eq(prodOperations.companyId, companyId))
    .orderBy(desc(prodOperations.createdAt))
    .limit(50);
}

export async function listFinalInspectionSources(companyId: string) {
  return db
    .select({
      id: productionOrders.id, orderNo: productionOrders.orderNo, productName: products.name, quantity: productionOrders.quantity, status: productionOrders.status
    })
    .from(productionOrders)
    .innerJoin(products, eq(products.id, productionOrders.productId))
    .where(and(eq(productionOrders.companyId, companyId)))
    .orderBy(desc(productionOrders.createdAt))
    .limit(50);
}
