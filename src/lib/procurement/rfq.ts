import 'server-only';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { procRequests, procRequestLines, procRfqs, procRfqLines, procRfqSuppliers, procQuotations, procQuotationLines, parties, users, products, units } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { ProcurementError } from './errors';

// Satınalma Faz 2 — Procurement Queue + RFQ (madde 47-65). Faz 1'in
// APPROVED taleplerini ve Master Data'nın SUPPLIER-rollü party'lerini
// TÜKETİR — hiçbiri için yeni bir kavram icat edilmedi.

// --- Procurement Queue — AYRI bir tablo değil, sorgu (madde 47-48). ---

export async function listProcurementQueue(companyId: string) {
  return db
    .select({
      lineId: procRequestLines.id, requestId: procRequests.id, requestNo: procRequests.requestNo,
      description: procRequestLines.description, quantity: procRequestLines.quantity, purchaseQty: procRequestLines.purchaseQty,
      unitId: procRequestLines.unitId, unitCode: units.code, productId: procRequestLines.productId,
      stockStatus: procRequestLines.stockStatus, requestedByName: users.fullName, priority: procRequests.priority
    })
    .from(procRequestLines)
    .innerJoin(procRequests, eq(procRequests.id, procRequestLines.requestId))
    .innerJoin(users, eq(users.id, procRequests.requestedByUserId))
    .innerJoin(units, eq(units.id, procRequestLines.unitId))
    .leftJoin(procRfqLines, eq(procRfqLines.srcRequestLineId, procRequestLines.id))
    .where(and(eq(procRequests.companyId, companyId), eq(procRequests.status, 'APPROVED'), isNull(procRfqLines.id)))
    .orderBy(desc(procRequests.completedAt));
}

// --- RFQ ---

export interface CreateRfqLineInput {
  srcRequestLineId?: string;
  productId?: string;
  description: string;
  quantity: number | string;
  unitId: string;
}

export interface CreateRfqInput {
  title: string;
  description?: string;
  quotationDeadline?: Date;
  deliveryLocation?: string;
  paymentTerms?: string;
  warrantyRequirement?: string;
  notes?: string;
  lines: CreateRfqLineInput[];
  supplierPartyIds: string[];
}

// madde 49-50 — BİRDEN FAZLA farklı talepten satır tek bir RFQ'da
// toplanabilir (her satır kendi srcRequestLineId'siyle bağımsız izlenir).
export async function createRfq(companyId: string, createdByUserId: string, input: CreateRfqInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir kalem gerekli.');
  if (input.supplierPartyIds.length === 0) throw new ProcurementError('En az bir tedarikçi davet edilmeli.');

  return db.transaction(async (tx) => {
    for (const line of input.lines) {
      if (line.srcRequestLineId) {
        const [alreadySourced] = await tx.select({ id: procRfqLines.id }).from(procRfqLines).where(eq(procRfqLines.srcRequestLineId, line.srcRequestLineId)).limit(1);
        if (alreadySourced) throw new ProcurementError('Bir talep satırı yalnızca bir RFQ\'ya eklenebilir — bu satır zaten eklenmiş.');
        const [reqLine] = await tx.select({ requestId: procRequestLines.requestId }).from(procRequestLines).where(eq(procRequestLines.id, line.srcRequestLineId)).limit(1);
        if (!reqLine) throw new ProcurementError('Talep satırı bulunamadı.');
        const [req] = await tx.select({ status: procRequests.status, companyId: procRequests.companyId }).from(procRequests).where(eq(procRequests.id, reqLine.requestId)).limit(1);
        if (!req || req.companyId !== companyId || req.status !== 'APPROVED') throw new ProcurementError('Yalnızca onaylanmış taleplerin satırları RFQ\'ya eklenebilir.');
      }
    }

    const id = newId();
    const rfqNo = await nextDocumentNo(tx, companyId, 'RFQ', 'RFQ', new Date().getFullYear(), 4);
    await tx.insert(procRfqs).values({
      id, companyId, rfqNo, title: input.title, description: input.description,
      quotationDeadline: input.quotationDeadline, deliveryLocation: input.deliveryLocation ?? '',
      paymentTerms: input.paymentTerms ?? '', warrantyRequirement: input.warrantyRequirement ?? '',
      notes: input.notes, createdByUserId
    });

    for (const line of input.lines) {
      await tx.insert(procRfqLines).values({
        id: newId(), rfqId: id, srcRequestLineId: line.srcRequestLineId, productId: line.productId,
        description: line.description, quantity: toDb(line.quantity), unitId: line.unitId
      });
    }

    for (const supplierPartyId of input.supplierPartyIds) {
      const [supplier] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, supplierPartyId), eq(parties.companyId, companyId))).limit(1);
      if (!supplier) throw new ProcurementError('Tedarikçi bulunamadı.');
      await tx.insert(procRfqSuppliers).values({ id: newId(), rfqId: id, supplierPartyId });
    }

    return id;
  });
}

export async function listRfqs(companyId: string) {
  return db
    .select({ id: procRfqs.id, rfqNo: procRfqs.rfqNo, title: procRfqs.title, status: procRfqs.status, quotationDeadline: procRfqs.quotationDeadline, createdAt: procRfqs.createdAt })
    .from(procRfqs)
    .where(eq(procRfqs.companyId, companyId))
    .orderBy(desc(procRfqs.createdAt));
}

export async function getRfq(companyId: string, rfqId: string) {
  const [rfq] = await db.select().from(procRfqs).where(and(eq(procRfqs.id, rfqId), eq(procRfqs.companyId, companyId))).limit(1);
  if (!rfq) throw new ProcurementError('RFQ bulunamadı.');

  const lines = await db
    .select({ id: procRfqLines.id, description: procRfqLines.description, quantity: procRfqLines.quantity, unitId: procRfqLines.unitId, unitCode: units.code, productId: procRfqLines.productId, productSku: products.sku })
    .from(procRfqLines)
    .innerJoin(units, eq(units.id, procRfqLines.unitId))
    .leftJoin(products, eq(products.id, procRfqLines.productId))
    .where(eq(procRfqLines.rfqId, rfqId));

  const suppliers = await db
    .select({ id: procRfqSuppliers.id, supplierPartyId: procRfqSuppliers.supplierPartyId, supplierName: parties.legalName, status: procRfqSuppliers.status, invitedAt: procRfqSuppliers.invitedAt })
    .from(procRfqSuppliers)
    .innerJoin(parties, eq(parties.id, procRfqSuppliers.supplierPartyId))
    .where(eq(procRfqSuppliers.rfqId, rfqId));

  const allQuotations = await db
    .select({ id: procQuotations.id, supplierPartyId: procQuotations.supplierPartyId, version: procQuotations.version, currencyCode: procQuotations.currencyCode, validUntil: procQuotations.validUntil, paymentTerms: procQuotations.paymentTerms, deliveryDays: procQuotations.deliveryDays, submittedAt: procQuotations.submittedAt, submittedByName: users.fullName })
    .from(procQuotations)
    .innerJoin(users, eq(users.id, procQuotations.submittedByUserId))
    .where(eq(procQuotations.rfqId, rfqId))
    .orderBy(desc(procQuotations.version));

  // Tedarikçi başına yalnızca EN SON versiyon "güncel" kabul edilir —
  // eskileri silinmez (madde 116-117), ama karşılaştırma/gösterim en
  // güncel olanı kullanır.
  const latestBySupplier = new Map<string, (typeof allQuotations)[number]>();
  for (const q of allQuotations) {
    if (!latestBySupplier.has(q.supplierPartyId)) latestBySupplier.set(q.supplierPartyId, q);
  }
  const latestQuotations = [...latestBySupplier.values()];
  const quotationIds = latestQuotations.map((q) => q.id);
  const quotationLines = quotationIds.length > 0 ? await db.select().from(procQuotationLines).where(inArray(procQuotationLines.quotationId, quotationIds)) : [];

  return { rfq, lines, suppliers, quotations: latestQuotations, allQuotationsCount: allQuotations.length, quotationLines };
}

export async function sendRfq(companyId: string, rfqId: string): Promise<void> {
  const [rfq] = await db.select({ id: procRfqs.id, status: procRfqs.status }).from(procRfqs).where(and(eq(procRfqs.id, rfqId), eq(procRfqs.companyId, companyId))).limit(1);
  if (!rfq) throw new ProcurementError('RFQ bulunamadı.');
  if (rfq.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak bir RFQ gönderilebilir.');
  await db.update(procRfqs).set({ status: 'SENT', sentAt: new Date() }).where(eq(procRfqs.id, rfqId));
}

export async function closeRfq(companyId: string, rfqId: string): Promise<void> {
  const [rfq] = await db.select({ id: procRfqs.id, status: procRfqs.status }).from(procRfqs).where(and(eq(procRfqs.id, rfqId), eq(procRfqs.companyId, companyId))).limit(1);
  if (!rfq) throw new ProcurementError('RFQ bulunamadı.');
  if (rfq.status !== 'SENT') throw new ProcurementError('Yalnızca gönderilmiş bir RFQ kapatılabilir.');
  await db.update(procRfqs).set({ status: 'CLOSED', closedAt: new Date() }).where(eq(procRfqs.id, rfqId));
}

// --- Teklif (madde 60-65, 117) ---

export interface SubmitQuotationLineInput {
  rfqLineId: string;
  unitPrice: number | string;
  discountPercent?: number | string;
  taxPercent?: number | string;
  deliveryDays?: number;
  isAlternative?: boolean;
  alternativeDescription?: string;
}

export interface SubmitQuotationInput {
  currencyCode: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  notes?: string;
  lines: SubmitQuotationLineInput[];
}

export async function submitQuotation(companyId: string, rfqId: string, supplierPartyId: string, submittedByUserId: string, input: SubmitQuotationInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir teklif satırı gerekli.');

  return db.transaction(async (tx) => {
    const [rfq] = await tx.select({ id: procRfqs.id, status: procRfqs.status }).from(procRfqs).where(and(eq(procRfqs.id, rfqId), eq(procRfqs.companyId, companyId))).limit(1);
    if (!rfq) throw new ProcurementError('RFQ bulunamadı.');
    // madde 63 — deadline geçtikten sonra normal giriş kapanır. CLOSED
    // durumu bu kontrolün karşılığı (elle kapatma — otomatik deadline
    // kontrolü bu sürümde yok, TODO: RFQ_DEADLINE_AUTO_CLOSE).
    if (rfq.status !== 'SENT') throw new ProcurementError('Yalnızca "Gönderildi" durumundaki bir RFQ için teklif girilebilir.');

    const [invited] = await tx.select({ id: procRfqSuppliers.id }).from(procRfqSuppliers).where(and(eq(procRfqSuppliers.rfqId, rfqId), eq(procRfqSuppliers.supplierPartyId, supplierPartyId))).limit(1);
    if (!invited) throw new ProcurementError('Bu tedarikçi bu RFQ\'ya davet edilmemiş.');

    const rfqLineIds = new Set((await tx.select({ id: procRfqLines.id }).from(procRfqLines).where(eq(procRfqLines.rfqId, rfqId))).map((l) => l.id));
    for (const line of input.lines) {
      if (!rfqLineIds.has(line.rfqLineId)) throw new ProcurementError('Teklif satırı bu RFQ\'ya ait olmayan bir kalemi referans ediyor.');
    }

    const existingVersions = await tx.select({ version: procQuotations.version }).from(procQuotations).where(and(eq(procQuotations.rfqId, rfqId), eq(procQuotations.supplierPartyId, supplierPartyId)));
    const nextVersion = existingVersions.length === 0 ? 1 : Math.max(...existingVersions.map((v) => v.version)) + 1;

    const quotationId = newId();
    await tx.insert(procQuotations).values({
      id: quotationId, rfqId, supplierPartyId, version: nextVersion,
      currencyCode: input.currencyCode, validUntil: input.validUntil, paymentTerms: input.paymentTerms ?? '',
      deliveryDays: input.deliveryDays, notes: input.notes, submittedByUserId
    });

    for (const line of input.lines) {
      await tx.insert(procQuotationLines).values({
        id: newId(), quotationId, rfqLineId: line.rfqLineId, unitPrice: toDb(line.unitPrice),
        discountPercent: line.discountPercent === undefined ? undefined : toDb(line.discountPercent),
        taxPercent: line.taxPercent === undefined ? undefined : toDb(line.taxPercent),
        deliveryDays: line.deliveryDays, isAlternative: line.isAlternative ?? false,
        alternativeDescription: line.alternativeDescription ?? ''
      });
    }

    await tx.update(procRfqSuppliers).set({ status: 'RESPONDED' }).where(and(eq(procRfqSuppliers.rfqId, rfqId), eq(procRfqSuppliers.supplierPartyId, supplierPartyId)));

    return quotationId;
  });
}

// --- Karşılaştırma (madde 66-68 — TEMEL fiyat karşılaştırması; ağırlıklı
// skorlama/teknik-ticari değerlendirme madde 69-74, Faz 3'ün kapsamı). ---

export interface ComparisonCell {
  supplierPartyId: string;
  supplierName: string;
  unitPrice: string;
  discountPercent: string;
  netUnitPrice: string;
  lineTotal: string;
  deliveryDays: number | null;
  isAlternative: boolean;
}

export interface ComparisonRow {
  rfqLineId: string;
  description: string;
  quantity: string;
  cells: ComparisonCell[];
}

export async function getRfqComparison(companyId: string, rfqId: string): Promise<ComparisonRow[]> {
  const { rfq, lines, quotations, quotationLines } = await getRfq(companyId, rfqId);
  void rfq;

  const supplierRows = await db
    .select({ supplierPartyId: procRfqSuppliers.supplierPartyId, supplierName: parties.legalName })
    .from(procRfqSuppliers)
    .innerJoin(parties, eq(parties.id, procRfqSuppliers.supplierPartyId))
    .where(eq(procRfqSuppliers.rfqId, rfqId));
  const supplierNameById = new Map(supplierRows.map((s) => [s.supplierPartyId, s.supplierName]));
  const quotationBySupplier = new Map(quotations.map((q) => [q.supplierPartyId, q.id]));

  return lines.map((line) => {
    const cells: ComparisonCell[] = [];
    for (const [supplierPartyId, quotationId] of quotationBySupplier.entries()) {
      const qLine = quotationLines.find((ql) => ql.quotationId === quotationId && ql.rfqLineId === line.id);
      if (!qLine) continue;
      const unitPrice = money(qLine.unitPrice);
      const discount = money(qLine.discountPercent ?? 0);
      const netUnitPrice = unitPrice.times(money(1).minus(discount.dividedBy(100)));
      const lineTotal = netUnitPrice.times(money(line.quantity));
      cells.push({
        supplierPartyId, supplierName: supplierNameById.get(supplierPartyId) ?? '—',
        unitPrice: unitPrice.toFixed(2), discountPercent: discount.toFixed(2), netUnitPrice: netUnitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2), deliveryDays: qLine.deliveryDays, isAlternative: qLine.isAlternative
      });
    }
    cells.sort((a, b) => Number(a.lineTotal) - Number(b.lineTotal));
    return { rfqLineId: line.id, description: line.description, quantity: line.quantity, cells };
  });
}
