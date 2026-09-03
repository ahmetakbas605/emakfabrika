import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  parties,
  products,
  salesOrderLines,
  salesOrders,
  units,
  weighbridges,
  weighbridgeTickets,
  WEIGHBRIDGE_TICKET_PURPOSES
} from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { MarketingError } from './errors';
import { checkRoadLegal, computeNetKg, evaluateFulfilment, toKg } from './weighing-math';

// Kantar iş mantığı — Pazarlama Faz 2.
//
// Kullanıcının kuralı: kg'lı ürün kantara TABİ (net kilo faturaya giden
// miktarı belirler), adetli ürün kantara GİRMEZ ama karayolları tonaj
// kontrolü için yine de fiş kesilir. purpose bu ikisini ayırır.

export type WeighbridgeTicketPurpose = (typeof WEIGHBRIDGE_TICKET_PURPOSES)[number];

export interface CreateWeighbridgeInput {
  departmentId: string;
  code: string;
  name: string;
  location?: string;
  capacityKg?: string;
  roadLegalLimitKg?: string;
  tolerancePercent?: string;
}

export async function createWeighbridge(companyId: string, input: CreateWeighbridgeInput): Promise<string> {
  const id = newId();
  await db.insert(weighbridges).values({
    id,
    companyId,
    departmentId: input.departmentId,
    code: input.code,
    name: input.name,
    location: input.location ?? '',
    capacityKg: input.capacityKg,
    roadLegalLimitKg: input.roadLegalLimitKg,
    tolerancePercent: input.tolerancePercent ?? '0'
  });
  return id;
}

export async function listWeighbridges(companyId: string, departmentId?: string) {
  const where = departmentId
    ? and(eq(weighbridges.companyId, companyId), eq(weighbridges.departmentId, departmentId))
    : eq(weighbridges.companyId, companyId);
  return db.select().from(weighbridges).where(where);
}

export interface CreateTicketInput {
  weighbridgeId: string;
  purpose: WeighbridgeTicketPurpose;
  direction?: 'OUTBOUND' | 'INBOUND';
  plateNo: string;
  driverName?: string;
  carrierName?: string;
  partyId?: string;
  productId?: string;
  orderLineId?: string;
  grossKg?: string;
  tareKg?: string;
  notes?: string;
}

export async function createWeighbridgeTicket(
  companyId: string,
  userId: string,
  input: CreateTicketInput
): Promise<string> {
  const [bridge] = await db
    .select({ id: weighbridges.id, roadLegalLimitKg: weighbridges.roadLegalLimitKg })
    .from(weighbridges)
    .where(and(eq(weighbridges.id, input.weighbridgeId), eq(weighbridges.companyId, companyId)))
    .limit(1);
  if (!bridge) throw new MarketingError('Kantar bulunamadı.');

  // Miktar amaçlı fişte sipariş satırı ZORUNLU — yoksa net kilo hiçbir
  // yere yazılamaz ve fiş faturaya dayanak olamaz.
  if (input.purpose === 'SALES_QUANTITY' && !input.orderLineId) {
    throw new MarketingError('Satış miktarı fişinde sipariş satırı seçilmelidir.');
  }

  // Net/tonaj/tolerans hesapları lib/marketing/weighing-math.ts'te —
  // saf fonksiyonlar, tests/weighbridge.test.ts ile doğrulanıyor.
  const net = computeNetKg(input.grossKg, input.tareKg);
  const netKg = net != null ? net.toFixed(3) : undefined;
  if (netKg != null && Number(netKg) <= 0) {
    throw new MarketingError('Net ağırlık sıfır veya negatif olamaz — brüt/dara değerlerini kontrol edin.');
  }

  // Karayolları tonaj kontrolü: BRÜT (yüklü araç) sınırla karşılaştırılır.
  // Limit tanımlı değilse kontrol yapılamaz, null bırakılır.
  const roadLegalCheck = checkRoadLegal(input.grossKg, bridge.roadLegalLimitKg);
  const roadLegalOk = roadLegalCheck ?? undefined;

  const id = newId();
  await db.transaction(async (tx) => {
    const ticketNo = await nextDocumentNo(tx, companyId, 'WEIGHBRIDGE_TICKET', 'KNT', new Date().getFullYear());
    await tx.insert(weighbridgeTickets).values({
      id,
      companyId,
      weighbridgeId: input.weighbridgeId,
      ticketNo,
      purpose: input.purpose,
      direction: input.direction ?? 'OUTBOUND',
      status: netKg != null ? 'COMPLETED' : 'DRAFT',
      plateNo: input.plateNo.toUpperCase().replace(/\s+/g, ''),
      driverName: input.driverName ?? '',
      carrierName: input.carrierName ?? '',
      partyId: input.partyId,
      productId: input.productId,
      orderLineId: input.orderLineId,
      grossKg: input.grossKg,
      tareKg: input.tareKg,
      netKg,
      firstWeighedAt: input.tareKg != null ? new Date() : undefined,
      secondWeighedAt: netKg != null ? new Date() : undefined,
      roadLegalOk,
      notes: input.notes ?? '',
      createdByUserId: userId,
      completedAt: netKg != null ? new Date() : undefined
    });
  });
  return id;
}

export async function listWeighbridgeTickets(companyId: string, weighbridgeId?: string) {
  const where = weighbridgeId
    ? and(eq(weighbridgeTickets.companyId, companyId), eq(weighbridgeTickets.weighbridgeId, weighbridgeId))
    : eq(weighbridgeTickets.companyId, companyId);

  return db
    .select({
      id: weighbridgeTickets.id,
      ticketNo: weighbridgeTickets.ticketNo,
      purpose: weighbridgeTickets.purpose,
      direction: weighbridgeTickets.direction,
      status: weighbridgeTickets.status,
      plateNo: weighbridgeTickets.plateNo,
      driverName: weighbridgeTickets.driverName,
      grossKg: weighbridgeTickets.grossKg,
      tareKg: weighbridgeTickets.tareKg,
      netKg: weighbridgeTickets.netKg,
      roadLegalOk: weighbridgeTickets.roadLegalOk,
      createdAt: weighbridgeTickets.createdAt,
      weighbridgeName: weighbridges.name,
      partyName: parties.legalName,
      productName: products.name
    })
    .from(weighbridgeTickets)
    .innerJoin(weighbridges, eq(weighbridges.id, weighbridgeTickets.weighbridgeId))
    .leftJoin(parties, eq(parties.id, weighbridgeTickets.partyId))
    .leftJoin(products, eq(products.id, weighbridgeTickets.productId))
    .where(where)
    .orderBy(desc(weighbridgeTickets.createdAt));
}

// "talep ve şuanki diyen veya eksik diyen bir ekran" — kullanıcının
// istediği görünüm. Sipariş satırındaki TALEP ile o satıra yazılmış
// tartımların NET TOPLAMI karşılaştırılır; fark EKSİK (ya da fazla).
//
// Ayrı bir "gerçekleşen" tablosu TUTULMAZ: tek kaynak tartım fişidir,
// toplam her seferinde ondan hesaplanır. İptal ve ters kayıt edilmiş
// fişler toplama girmez.
export interface FulfilmentRow {
  orderId: string;
  orderNo: string;
  orderLineId: string;
  partyName: string;
  productName: string;
  productUnitCode: string;
  requestedQty: string;
  requestedKg: number | null;
  deliveredKg: number;
  remainingKg: number | null;
  tolerancePercent: number;
  withinTolerance: boolean | null;
}

export async function listOrderFulfilment(companyId: string, tolerancePercent = 0): Promise<FulfilmentRow[]> {
  // Açık siparişlerin kg-bazlı satırları. Ürünün birimi kg değilse
  // units.conversionFactor ile kg'ye çevrilir (baseUnit = kg varsayımı
  // DEĞİL: çarpan tanımlı değilse çevrim yapılmaz, null döner).
  const lines = await db
    .select({
      orderId: salesOrders.id,
      orderNo: salesOrders.orderNo,
      orderLineId: salesOrderLines.id,
      partyName: parties.legalName,
      productName: products.name,
      productUnitCode: units.code,
      conversionFactor: units.conversionFactor,
      requestedQty: salesOrderLines.quantity
    })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderLines.orderId))
    .innerJoin(parties, eq(parties.id, salesOrders.partyId))
    .innerJoin(products, eq(products.id, salesOrderLines.productId))
    .leftJoin(units, eq(units.id, products.salesUnitId))
    .where(and(eq(salesOrders.companyId, companyId), inArray(salesOrders.status, ['CONFIRMED', 'SUBMITTED'])));

  if (lines.length === 0) return [];

  // Satır başına teslim edilen net toplam — yalnızca TAMAMLANMIŞ fişler.
  const delivered = await db
    .select({
      orderLineId: weighbridgeTickets.orderLineId,
      total: sql<string>`COALESCE(SUM(${weighbridgeTickets.netKg}), 0)`
    })
    .from(weighbridgeTickets)
    .where(
      and(
        eq(weighbridgeTickets.companyId, companyId),
        eq(weighbridgeTickets.status, 'COMPLETED'),
        eq(weighbridgeTickets.purpose, 'SALES_QUANTITY'),
        inArray(
          weighbridgeTickets.orderLineId,
          lines.map((l) => l.orderLineId)
        )
      )
    )
    .groupBy(weighbridgeTickets.orderLineId);

  const deliveredByLine = new Map(delivered.map((d) => [d.orderLineId, Number(d.total)]));

  return lines.map((l) => {
    const requestedKg = toKg(l.requestedQty, l.productUnitCode, l.conversionFactor);
    const deliveredKg = deliveredByLine.get(l.orderLineId) ?? 0;
    const { remainingKg, withinTolerance } = evaluateFulfilment(requestedKg, deliveredKg, tolerancePercent);

    return {
      orderId: l.orderId,
      orderNo: l.orderNo,
      orderLineId: l.orderLineId,
      partyName: l.partyName,
      productName: l.productName,
      productUnitCode: l.productUnitCode ?? '—',
      requestedQty: l.requestedQty,
      requestedKg,
      deliveredKg,
      remainingKg,
      tolerancePercent,
      withinTolerance
    };
  });
}

// İptal — fiş SİLİNMEZ, durumu değişir. 'cancel' yetkisi çağıranda
// kontrol edilir (actions katmanı).
export async function cancelWeighbridgeTicket(companyId: string, ticketId: string, reason: string): Promise<void> {
  const [row] = await db
    .select({ id: weighbridgeTickets.id, status: weighbridgeTickets.status })
    .from(weighbridgeTickets)
    .where(and(eq(weighbridgeTickets.id, ticketId), eq(weighbridgeTickets.companyId, companyId)))
    .limit(1);
  if (!row) throw new MarketingError('Tartım fişi bulunamadı.');
  if (row.status === 'CANCELLED' || row.status === 'REVERSED') {
    throw new MarketingError('Bu fiş zaten iptal/ters kayıt edilmiş.');
  }
  await db
    .update(weighbridgeTickets)
    .set({ status: 'CANCELLED', cancelReason: reason })
    .where(eq(weighbridgeTickets.id, ticketId));
}

// Ters kayıt — orijinal fiş REVERSED olur, net'i sıfırlayan YENİ bir fiş
// açılır. Böylece defterde iz kalır (silme yok) ama toplamlar düzelir.
// 'correct_weighing' yetkisi çağıranda kontrol edilir.
export async function reverseWeighbridgeTicket(
  companyId: string,
  userId: string,
  ticketId: string,
  reason: string
): Promise<string> {
  const [original] = await db
    .select()
    .from(weighbridgeTickets)
    .where(and(eq(weighbridgeTickets.id, ticketId), eq(weighbridgeTickets.companyId, companyId)))
    .limit(1);
  if (!original) throw new MarketingError('Tartım fişi bulunamadı.');
  if (original.status !== 'COMPLETED') throw new MarketingError('Yalnızca tamamlanmış fiş ters kayıt edilebilir.');

  const newTicketId = newId();
  await db.transaction(async (tx) => {
    const ticketNo = await nextDocumentNo(tx, companyId, 'WEIGHBRIDGE_TICKET', 'KNT', new Date().getFullYear());
    await tx.insert(weighbridgeTickets).values({
      id: newTicketId,
      companyId,
      weighbridgeId: original.weighbridgeId,
      ticketNo,
      purpose: original.purpose,
      direction: original.direction,
      status: 'COMPLETED',
      plateNo: original.plateNo,
      driverName: original.driverName,
      carrierName: original.carrierName,
      partyId: original.partyId,
      productId: original.productId,
      orderLineId: original.orderLineId,
      grossKg: original.grossKg,
      tareKg: original.tareKg,
      // Ters kayıt: net NEGATİF, böylece toplam sıfırlanır.
      netKg: original.netKg != null ? (-Number(original.netKg)).toFixed(3) : undefined,
      roadLegalOk: original.roadLegalOk,
      notes: `Ters kayıt — ${original.ticketNo}. Sebep: ${reason}`,
      reversalOfTicketId: original.id,
      createdByUserId: userId,
      completedAt: new Date()
    });
    await tx
      .update(weighbridgeTickets)
      .set({ status: 'REVERSED', cancelReason: reason })
      .where(eq(weighbridgeTickets.id, ticketId));
  });
  return newTicketId;
}
