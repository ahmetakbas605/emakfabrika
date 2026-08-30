import 'server-only';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { procTenders, procTenderLines, procTenderSuppliers, procTenderBids, procTenderBidLines, parties, units, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { ProcurementError } from './errors';

// Satınalma Faz 8A/8B — İhale (Tender). proc_rfqs/proc_rfq_lines/
// proc_rfq_suppliers/proc_quotations/proc_quotation_lines'ın (Faz 2, lib/
// procurement/rfq.ts) NEREDEYSE BİREBİR aynı şekli. Faz 8B'nin tek gerçek
// eklediği şey İFŞA KAPISI: getTenderBidComparison, tender OPENED
// olmadan hiçbir fiyat/miktar döndürmez (aşağıda, kendi yorumunda detaylı).

export interface CreateTenderLineInput {
  srcRequestLineId?: string;
  productId?: string;
  description: string;
  quantity: number | string;
  unitId: string;
}

export interface CreateTenderInput {
  title: string;
  description?: string;
  bidSubmissionDeadline?: Date;
  bidOpeningAt?: Date;
  deliveryLocation?: string;
  paymentTerms?: string;
  warrantyRequirement?: string;
  bidBondRequired?: boolean;
  bidBondPercent?: number | string;
  bidBondAmount?: number | string;
  openParticipation?: boolean;
  notes?: string;
  lines: CreateTenderLineInput[];
  supplierPartyIds: string[];
}

export async function createTender(companyId: string, createdByUserId: string, input: CreateTenderInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir kalem gerekli.');
  if (!input.openParticipation && input.supplierPartyIds.length === 0) {
    throw new ProcurementError('Davetli katılımlı bir ihalede en az bir tedarikçi davet edilmeli.');
  }
  if (input.bidSubmissionDeadline && input.bidOpeningAt && input.bidOpeningAt < input.bidSubmissionDeadline) {
    throw new ProcurementError('Açılış anı, teklif son tarihinden ÖNCE olamaz.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const tenderNo = await nextDocumentNo(tx, companyId, 'TND', 'TND', new Date().getFullYear(), 4);
    await tx.insert(procTenders).values({
      id, companyId, tenderNo, title: input.title, description: input.description,
      bidSubmissionDeadline: input.bidSubmissionDeadline, bidOpeningAt: input.bidOpeningAt,
      deliveryLocation: input.deliveryLocation ?? '', paymentTerms: input.paymentTerms ?? '', warrantyRequirement: input.warrantyRequirement ?? '',
      bidBondRequired: input.bidBondRequired ?? false,
      bidBondPercent: input.bidBondPercent === undefined ? undefined : toDb(input.bidBondPercent),
      bidBondAmount: input.bidBondAmount === undefined ? undefined : toDb(input.bidBondAmount),
      openParticipation: input.openParticipation ?? false,
      notes: input.notes, createdByUserId
    });

    for (const line of input.lines) {
      await tx.insert(procTenderLines).values({
        id: newId(), tenderId: id, srcRequestLineId: line.srcRequestLineId, productId: line.productId,
        description: line.description, quantity: toDb(line.quantity), unitId: line.unitId
      });
    }

    for (const supplierPartyId of input.supplierPartyIds) {
      const [supplier] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, supplierPartyId), eq(parties.companyId, companyId))).limit(1);
      if (!supplier) throw new ProcurementError('Tedarikçi bulunamadı.');
      await tx.insert(procTenderSuppliers).values({ id: newId(), tenderId: id, supplierPartyId });
    }

    return id;
  });
}

export async function listTenders(companyId: string) {
  return db
    .select({ id: procTenders.id, tenderNo: procTenders.tenderNo, title: procTenders.title, status: procTenders.status, bidSubmissionDeadline: procTenders.bidSubmissionDeadline, bidOpeningAt: procTenders.bidOpeningAt, createdAt: procTenders.createdAt })
    .from(procTenders)
    .where(eq(procTenders.companyId, companyId))
    .orderBy(desc(procTenders.createdAt));
}

export async function getTender(companyId: string, tenderId: string) {
  const [tender] = await db.select().from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');

  const lines = await db
    .select({ id: procTenderLines.id, description: procTenderLines.description, quantity: procTenderLines.quantity, unitId: procTenderLines.unitId, unitCode: units.code, productId: procTenderLines.productId, productSku: products.sku })
    .from(procTenderLines)
    .innerJoin(units, eq(units.id, procTenderLines.unitId))
    .leftJoin(products, eq(products.id, procTenderLines.productId))
    .where(eq(procTenderLines.tenderId, tenderId));

  const suppliers = await db
    .select({ id: procTenderSuppliers.id, supplierPartyId: procTenderSuppliers.supplierPartyId, supplierName: parties.legalName, status: procTenderSuppliers.status, invitedAt: procTenderSuppliers.invitedAt })
    .from(procTenderSuppliers)
    .innerJoin(parties, eq(parties.id, procTenderSuppliers.supplierPartyId))
    .where(eq(procTenderSuppliers.tenderId, tenderId));

  return { tender, lines, suppliers };
}

// madde (İhale Kapsamı raporu §3) — yayınlama, sendRfq (Faz 2) İLE AYNI
// gerekçeyle bir onay akışından GEÇMEZ: harcama taahhüdü Award aşamasında
// (Faz 4'ün genelleneceği Faz 8C) kuruluyor, yayınlamanın kendisi henüz
// bir taahhüt değil.
export async function publishTender(companyId: string, tenderId: string): Promise<void> {
  const [tender] = await db.select({ id: procTenders.id, status: procTenders.status }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir ihale yayınlanabilir.');
  await db.update(procTenders).set({ status: 'PUBLISHED', publishedAt: new Date() }).where(eq(procTenders.id, tenderId));
}

export async function cancelTender(companyId: string, tenderId: string): Promise<void> {
  const [tender] = await db.select({ id: procTenders.id, status: procTenders.status }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status === 'CANCELLED') throw new ProcurementError('İhale zaten iptal edilmiş.');
  await db.update(procTenders).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(eq(procTenders.id, tenderId));
}

// --- Faz 8B — Kapalı Zarf Teklif (madde 116-117 immutable/versiyonlu ilkesi,
// proc_quotations İLE AYNI). madde (İhale Kapsamı raporu §3) — "gerçek
// dünyada teklif son tarihine kadar teklif alınır" kuralı BURADA
// UYGULANIYOR, RFQ'nun aksine (RFQ_DEADLINE_AUTO_CLOSE hâlâ TODO): İhale'nin
// kapalı-zarf/resmi doğası, son tarihin GERÇEK bir kontrol olmasını
// gerektiriyor — deadline geçtiyse submitTenderBid REDDEDER. ---

export interface SubmitTenderBidLineInput {
  tenderLineId: string;
  unitPrice: number | string;
  discountPercent?: number | string;
  taxPercent?: number | string;
  deliveryDays?: number;
  isAlternative?: boolean;
  alternativeDescription?: string;
}

export interface SubmitTenderBidInput {
  currencyCode: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  bidBondReference?: string;
  notes?: string;
  lines: SubmitTenderBidLineInput[];
}

export async function submitTenderBid(companyId: string, tenderId: string, supplierPartyId: string, submittedByUserId: string, input: SubmitTenderBidInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir teklif satırı gerekli.');

  return db.transaction(async (tx) => {
    const [tender] = await tx.select().from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
    if (!tender) throw new ProcurementError('İhale bulunamadı.');
    if (tender.status !== 'PUBLISHED') throw new ProcurementError('Yalnızca yayınlanmış (PUBLISHED) bir ihale için teklif verilebilir.');
    if (tender.bidSubmissionDeadline && new Date() > tender.bidSubmissionDeadline) {
      throw new ProcurementError('Teklif son tarihi geçti — bu ihaleye artık teklif verilemez.');
    }

    const [invited] = await tx.select({ id: procTenderSuppliers.id }).from(procTenderSuppliers).where(and(eq(procTenderSuppliers.tenderId, tenderId), eq(procTenderSuppliers.supplierPartyId, supplierPartyId))).limit(1);
    if (!invited) {
      // madde (İhale Kapsamı raporu §2) — açık katılımda tedarikçi kendi
      // teklifini vererek KENDİNİ ekler (RESPONDED, INVITED aşaması atlanır
      // — hiç davet edilmedi ki).
      if (!tender.openParticipation) throw new ProcurementError('Bu tedarikçi bu ihaleye davet edilmemiş.');
      await tx.insert(procTenderSuppliers).values({ id: newId(), tenderId, supplierPartyId, status: 'RESPONDED' });
    } else {
      await tx.update(procTenderSuppliers).set({ status: 'RESPONDED' }).where(and(eq(procTenderSuppliers.tenderId, tenderId), eq(procTenderSuppliers.supplierPartyId, supplierPartyId)));
    }

    const tenderLineIds = new Set((await tx.select({ id: procTenderLines.id }).from(procTenderLines).where(eq(procTenderLines.tenderId, tenderId))).map((l) => l.id));
    for (const line of input.lines) {
      if (!tenderLineIds.has(line.tenderLineId)) throw new ProcurementError('Teklif satırı bu ihaleye ait olmayan bir kalemi referans ediyor.');
    }

    const existingVersions = await tx.select({ version: procTenderBids.version }).from(procTenderBids).where(and(eq(procTenderBids.tenderId, tenderId), eq(procTenderBids.supplierPartyId, supplierPartyId)));
    const nextVersion = existingVersions.length === 0 ? 1 : Math.max(...existingVersions.map((v) => v.version)) + 1;

    const bidId = newId();
    await tx.insert(procTenderBids).values({
      id: bidId, tenderId, supplierPartyId, version: nextVersion,
      currencyCode: input.currencyCode, validUntil: input.validUntil, paymentTerms: input.paymentTerms ?? '',
      deliveryDays: input.deliveryDays, bidBondReference: input.bidBondReference ?? '', notes: input.notes, submittedByUserId
    });

    for (const line of input.lines) {
      await tx.insert(procTenderBidLines).values({
        id: newId(), bidId, tenderLineId: line.tenderLineId, unitPrice: toDb(line.unitPrice),
        discountPercent: line.discountPercent === undefined ? undefined : toDb(line.discountPercent),
        taxPercent: line.taxPercent === undefined ? undefined : toDb(line.taxPercent),
        deliveryDays: line.deliveryDays, isAlternative: line.isAlternative ?? false,
        alternativeDescription: line.alternativeDescription ?? ''
      });
    }

    return bidId;
  });
}

// Açılıştan ÖNCE de güvenle çağrılabilir — yalnızca KİM teklif verdi
// bilgisini döner, fiyat/miktar İÇERMEZ (İfşa Kapısı bu fonksiyonun kendisi
// değil, getTenderBidComparison'ın DAVRANIŞI).
export async function listTenderBidParticipation(companyId: string, tenderId: string) {
  const [tender] = await db.select({ id: procTenders.id }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');

  const bids = await db
    .select({ supplierPartyId: procTenderBids.supplierPartyId, supplierName: parties.legalName, version: procTenderBids.version, submittedAt: procTenderBids.submittedAt })
    .from(procTenderBids)
    .innerJoin(parties, eq(parties.id, procTenderBids.supplierPartyId))
    .where(eq(procTenderBids.tenderId, tenderId))
    .orderBy(desc(procTenderBids.version));

  const latestBySupplier = new Map<string, (typeof bids)[number]>();
  for (const b of bids) if (!latestBySupplier.has(b.supplierPartyId)) latestBySupplier.set(b.supplierPartyId, b);
  return [...latestBySupplier.values()];
}

// madde (İhale Kapsamı raporu §3) — açılış, PLANLANAN andan (bidOpeningAt)
// ÖNCE yapılamaz (gerçek dünyada "teklif toplama süresi dolmadan zarflar
// açılamaz" kuralı) — deadline geçmemişse veya bidOpeningAt henüz
// gelmemişse reddedilir. status PUBLISHED olmalı.
export async function openTenderBidding(companyId: string, tenderId: string, openedByUserId: string): Promise<void> {
  const [tender] = await db.select().from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status !== 'PUBLISHED') throw new ProcurementError('Yalnızca yayınlanmış (PUBLISHED) bir ihale açılabilir.');
  const now = new Date();
  if (tender.bidOpeningAt && now < tender.bidOpeningAt) throw new ProcurementError(`Açılış anı henüz gelmedi (${tender.bidOpeningAt.toLocaleString('tr-TR')}).`);
  if (tender.bidSubmissionDeadline && now < tender.bidSubmissionDeadline) throw new ProcurementError('Teklif toplama süresi dolmadan ihale açılamaz.');
  await db.update(procTenders).set({ status: 'OPENED', openedAt: now, openedByUserId }).where(eq(procTenders.id, tenderId));
}

export interface TenderBidComparisonCell {
  supplierPartyId: string;
  supplierName: string;
  tenderBidLineId: string;
  unitPrice: string;
  discountPercent: string;
  netUnitPrice: string;
  lineTotal: string;
  deliveryDays: number | null;
  isAlternative: boolean;
}

export interface TenderBidComparisonRow {
  tenderLineId: string;
  description: string;
  quantity: string;
  cells: TenderBidComparisonCell[];
}

// İFŞA KAPISI — tender OPENED (veya AWARDED, açılıştan sonraki bir durum)
// olmadan ProcurementError fırlatır, fiyat/miktar HİÇBİR durumda dönmez.
export async function getTenderBidComparison(companyId: string, tenderId: string): Promise<TenderBidComparisonRow[]> {
  const { tender, lines } = await getTender(companyId, tenderId);
  if (tender.status !== 'OPENED' && tender.status !== 'AWARDED') {
    throw new ProcurementError('Teklifler henüz açılmadı — içerik, açılış anına kadar gizlidir.');
  }

  const allBids = await db
    .select({ id: procTenderBids.id, supplierPartyId: procTenderBids.supplierPartyId, supplierName: parties.legalName, version: procTenderBids.version })
    .from(procTenderBids)
    .innerJoin(parties, eq(parties.id, procTenderBids.supplierPartyId))
    .where(eq(procTenderBids.tenderId, tenderId))
    .orderBy(desc(procTenderBids.version));

  const latestBySupplier = new Map<string, (typeof allBids)[number]>();
  for (const b of allBids) if (!latestBySupplier.has(b.supplierPartyId)) latestBySupplier.set(b.supplierPartyId, b);
  const latestBids = [...latestBySupplier.values()];
  const bidIds = latestBids.map((b) => b.id);
  const bidLines = bidIds.length > 0 ? await db.select().from(procTenderBidLines).where(inArray(procTenderBidLines.bidId, bidIds)) : [];

  return lines.map((line) => {
    const cells: TenderBidComparisonCell[] = [];
    for (const bid of latestBids) {
      const bLine = bidLines.find((bl) => bl.bidId === bid.id && bl.tenderLineId === line.id);
      if (!bLine) continue;
      const unitPrice = money(bLine.unitPrice);
      const discount = money(bLine.discountPercent ?? 0);
      const netUnitPrice = unitPrice.times(money(1).minus(discount.dividedBy(100)));
      const lineTotal = netUnitPrice.times(money(line.quantity));
      cells.push({
        supplierPartyId: bid.supplierPartyId, supplierName: bid.supplierName, tenderBidLineId: bLine.id,
        unitPrice: unitPrice.toFixed(2), discountPercent: discount.toFixed(2), netUnitPrice: netUnitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2), deliveryDays: bLine.deliveryDays, isAlternative: bLine.isAlternative
      });
    }
    cells.sort((a, b) => Number(a.lineTotal) - Number(b.lineTotal));
    return { tenderLineId: line.id, description: line.description, quantity: line.quantity, cells };
  });
}
