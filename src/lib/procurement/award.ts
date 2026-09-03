import 'server-only';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { procAwards, procAwardLines, procRfqs, procRfqLines, procQuotations, procQuotationLines, procTenders, procTenderLines, procTenderBids, procTenderBidLines, parties, units, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { startApprovalInTx, actOnStepInTx, getApprovalInstance, type ApprovalDecision } from '@/lib/workflow/engine';
import { ProcurementError } from './errors';

// Satınalma Faz 4 — Award (madde 75-82). Faz 3'ün değerlendirmesini
// (getRfqEvaluation) TÜKETİR — kullanıcı ekranda gördüğü ağırlıklı skora
// bakarak hangi tedarikçiyi/hangi teklif satırını seçtiğine KENDİSİ karar
// verir, motor otomatik "en iyiyi seç" YAPMAZ (madde 141'in "skorlama nihai
// karar verici değil, öneri verir" ilkesi Faz 3'te de aynı gerekçeyle
// uygulanmıştı).

export interface CreateAwardLineInput {
  rfqLineId: string;
  supplierPartyId: string;
  quotationLineId: string;
  awardedQty: number | string;
}

export interface CreateAwardInput {
  lines: CreateAwardLineInput[];
}

async function requireClosedRfq(companyId: string, rfqId: string) {
  const [rfq] = await db.select({ id: procRfqs.id, status: procRfqs.status }).from(procRfqs).where(and(eq(procRfqs.id, rfqId), eq(procRfqs.companyId, companyId))).limit(1);
  if (!rfq) throw new ProcurementError('RFQ bulunamadı.');
  if (rfq.status !== 'CLOSED') throw new ProcurementError('Yalnızca teklif toplama kapatılmış (CLOSED) bir RFQ için ödül oluşturulabilir.');
  return rfq;
}

// madde 75-77 — bölünmüş/kısmi ödül: bir RFQ satırı BİRDEN FAZLA award
// satırına (farklı tedarikçi+miktar) dağılabilir, toplamı satırın
// miktarını AŞAMAZ (eksik kalması sorun değil — kısmi ödül madde 75'in
// kendi kapsamında).
async function validateAwardLines(companyId: string, rfqId: string, lines: CreateAwardLineInput[]): Promise<void> {
  if (lines.length === 0) throw new ProcurementError('En az bir ödül satırı gerekli.');

  const rfqLines = await db.select({ id: procRfqLines.id, quantity: procRfqLines.quantity }).from(procRfqLines).where(eq(procRfqLines.rfqId, rfqId));
  const rfqLineById = new Map(rfqLines.map((l) => [l.id, l]));

  const quotationLineIds = [...new Set(lines.map((l) => l.quotationLineId))];
  const quotationLineRows = await db
    .select({ id: procQuotationLines.id, rfqLineId: procQuotationLines.rfqLineId, quotationId: procQuotationLines.quotationId, unitPrice: procQuotationLines.unitPrice, discountPercent: procQuotationLines.discountPercent })
    .from(procQuotationLines)
    .where(inArray(procQuotationLines.id, quotationLineIds));
  const quotationLineById = new Map(quotationLineRows.map((q) => [q.id, q]));

  const quotationIds = [...new Set(quotationLineRows.map((q) => q.quotationId))];
  const quotationRows = quotationIds.length > 0 ? await db.select({ id: procQuotations.id, rfqId: procQuotations.rfqId, supplierPartyId: procQuotations.supplierPartyId }).from(procQuotations).where(inArray(procQuotations.id, quotationIds)) : [];
  const quotationById = new Map(quotationRows.map((q) => [q.id, q]));

  const qtyByRfqLine = new Map<string, ReturnType<typeof money>>();
  for (const line of lines) {
    const rfqLine = rfqLineById.get(line.rfqLineId);
    if (!rfqLine) throw new ProcurementError('Ödül satırı bu RFQ\'ya ait olmayan bir kalemi referans ediyor.');

    const qLine = quotationLineById.get(line.quotationLineId);
    if (!qLine || qLine.rfqLineId !== line.rfqLineId) throw new ProcurementError('Ödül satırı, referans ettiği teklif satırıyla eşleşmiyor.');

    const quotation = quotationById.get(qLine.quotationId);
    if (!quotation || quotation.rfqId !== rfqId || quotation.supplierPartyId !== line.supplierPartyId) {
      throw new ProcurementError('Ödül satırındaki tedarikçi, referans edilen teklifle eşleşmiyor.');
    }

    const qty = money(line.awardedQty);
    if (qty.lessThanOrEqualTo(0)) throw new ProcurementError('Ödül miktarı sıfırdan büyük olmalı.');
    qtyByRfqLine.set(line.rfqLineId, (qtyByRfqLine.get(line.rfqLineId) ?? money(0)).plus(qty));
  }

  for (const [rfqLineId, totalQty] of qtyByRfqLine.entries()) {
    const rfqLine = rfqLineById.get(rfqLineId)!;
    if (totalQty.greaterThan(money(rfqLine.quantity))) {
      throw new ProcurementError(`Kalem için ödül edilen toplam miktar (${totalQty.toFixed(2)}) RFQ miktarını (${rfqLine.quantity}) aşamaz.`);
    }
  }
}

export async function createAward(companyId: string, createdByUserId: string, rfqId: string, input: CreateAwardInput): Promise<string> {
  await requireClosedRfq(companyId, rfqId);
  await validateAwardLines(companyId, rfqId, input.lines);

  const [existingActive] = await db
    .select({ id: procAwards.id })
    .from(procAwards)
    .where(and(eq(procAwards.rfqId, rfqId), inArray(procAwards.status, ['DRAFT', 'SUBMITTED', 'APPROVED', 'REVISION_REQUIRED'])))
    .limit(1);
  if (existingActive) throw new ProcurementError('Bu RFQ için zaten aktif bir ödül kaydı var.');

  return db.transaction(async (tx) => {
    const id = newId();
    const awardNo = await nextDocumentNo(tx, companyId, 'AWD', 'AWD', new Date().getFullYear(), 6);
    await tx.insert(procAwards).values({ id, companyId, rfqId, awardNo, status: 'DRAFT', createdByUserId });

    for (const line of input.lines) {
      const [qLine] = await tx.select({ unitPrice: procQuotationLines.unitPrice, discountPercent: procQuotationLines.discountPercent }).from(procQuotationLines).where(eq(procQuotationLines.id, line.quotationLineId)).limit(1);
      // madde 116-117 immutable ilkesi — ödül anındaki fiyat SNAPSHOT'lanır,
      // teklife canlı referans YOK (tedarikçi sonradan yeni versiyon
      // gönderse bile bu ödül kaydı DEĞİŞMEZ).
      const netUnitPrice = money(qLine!.unitPrice).times(money(1).minus(money(qLine!.discountPercent ?? 0).dividedBy(100)));
      const qty = money(line.awardedQty);
      await tx.insert(procAwardLines).values({
        id: newId(), awardId: id, rfqLineId: line.rfqLineId, supplierPartyId: line.supplierPartyId, quotationLineId: line.quotationLineId,
        awardedQty: toDb(qty), awardedUnitPrice: toDb(netUnitPrice), awardedTotal: toDb(qty.times(netUnitPrice))
      });
    }

    return id;
  });
}

// --- Faz 8B — Tender kaynaklı ödül. createAward'ın (RFQ) İLE BİREBİR AYNI
// yapısı, YALNIZCA proc_rfqs/proc_rfq_lines/proc_quotations/
// proc_quotation_lines yerine proc_tenders/proc_tender_lines/
// proc_tender_bids/proc_tender_bid_lines'tan okur. Kasıtlı olarak AYRI bir
// fonksiyon — tek bir "generic source" soyutlaması yerine, tıpkı
// actOnRequisitionStep/actOnAwardStep'in AYRI kalması gibi (küçük,
// gerekçeli tekrar; erken soyutlamadan iyi). createAward'ın KENDİSİ bu
// eklemeden HİÇ etkilenmedi — schema.ts'teki nullable kolonlar onun zaten
// doldurduğu alanları etkilemiyor. ---

export interface CreateTenderAwardLineInput {
  tenderLineId: string;
  supplierPartyId: string;
  tenderBidLineId: string;
  awardedQty: number | string;
}

export interface CreateTenderAwardInput {
  lines: CreateTenderAwardLineInput[];
}

async function requireOpenedTender(companyId: string, tenderId: string) {
  const [tender] = await db.select({ id: procTenders.id, status: procTenders.status }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status !== 'OPENED') throw new ProcurementError('Yalnızca teklifleri açılmış (OPENED) bir ihale için ödül oluşturulabilir.');
  return tender;
}

async function validateTenderAwardLines(companyId: string, tenderId: string, lines: CreateTenderAwardLineInput[]): Promise<void> {
  if (lines.length === 0) throw new ProcurementError('En az bir ödül satırı gerekli.');

  const tenderLines = await db.select({ id: procTenderLines.id, quantity: procTenderLines.quantity }).from(procTenderLines).where(eq(procTenderLines.tenderId, tenderId));
  const tenderLineById = new Map(tenderLines.map((l) => [l.id, l]));

  const tenderBidLineIds = [...new Set(lines.map((l) => l.tenderBidLineId))];
  const bidLineRows = await db
    .select({ id: procTenderBidLines.id, tenderLineId: procTenderBidLines.tenderLineId, bidId: procTenderBidLines.bidId, unitPrice: procTenderBidLines.unitPrice, discountPercent: procTenderBidLines.discountPercent })
    .from(procTenderBidLines)
    .where(inArray(procTenderBidLines.id, tenderBidLineIds));
  const bidLineById = new Map(bidLineRows.map((b) => [b.id, b]));

  const bidIds = [...new Set(bidLineRows.map((b) => b.bidId))];
  const bidRows = bidIds.length > 0 ? await db.select({ id: procTenderBids.id, tenderId: procTenderBids.tenderId, supplierPartyId: procTenderBids.supplierPartyId }).from(procTenderBids).where(inArray(procTenderBids.id, bidIds)) : [];
  const bidById = new Map(bidRows.map((b) => [b.id, b]));

  const qtyByTenderLine = new Map<string, ReturnType<typeof money>>();
  for (const line of lines) {
    const tenderLine = tenderLineById.get(line.tenderLineId);
    if (!tenderLine) throw new ProcurementError('Ödül satırı bu ihaleye ait olmayan bir kalemi referans ediyor.');

    const bLine = bidLineById.get(line.tenderBidLineId);
    if (!bLine || bLine.tenderLineId !== line.tenderLineId) throw new ProcurementError('Ödül satırı, referans ettiği teklif satırıyla eşleşmiyor.');

    const bid = bidById.get(bLine.bidId);
    if (!bid || bid.tenderId !== tenderId || bid.supplierPartyId !== line.supplierPartyId) {
      throw new ProcurementError('Ödül satırındaki tedarikçi, referans edilen teklifle eşleşmiyor.');
    }

    const qty = money(line.awardedQty);
    if (qty.lessThanOrEqualTo(0)) throw new ProcurementError('Ödül miktarı sıfırdan büyük olmalı.');
    qtyByTenderLine.set(line.tenderLineId, (qtyByTenderLine.get(line.tenderLineId) ?? money(0)).plus(qty));
  }

  for (const [tenderLineId, totalQty] of qtyByTenderLine.entries()) {
    const tenderLine = tenderLineById.get(tenderLineId)!;
    if (totalQty.greaterThan(money(tenderLine.quantity))) {
      throw new ProcurementError(`Kalem için ödül edilen toplam miktar (${totalQty.toFixed(2)}) ihale miktarını (${tenderLine.quantity}) aşamaz.`);
    }
  }
}

export async function createAwardFromTender(companyId: string, createdByUserId: string, tenderId: string, input: CreateTenderAwardInput): Promise<string> {
  await requireOpenedTender(companyId, tenderId);
  await validateTenderAwardLines(companyId, tenderId, input.lines);

  const [existingActive] = await db
    .select({ id: procAwards.id })
    .from(procAwards)
    .where(and(eq(procAwards.tenderId, tenderId), inArray(procAwards.status, ['DRAFT', 'SUBMITTED', 'APPROVED', 'REVISION_REQUIRED'])))
    .limit(1);
  if (existingActive) throw new ProcurementError('Bu ihale için zaten aktif bir ödül kaydı var.');

  return db.transaction(async (tx) => {
    const id = newId();
    const awardNo = await nextDocumentNo(tx, companyId, 'AWD', 'AWD', new Date().getFullYear(), 6);
    await tx.insert(procAwards).values({ id, companyId, tenderId, awardNo, status: 'DRAFT', createdByUserId });

    for (const line of input.lines) {
      const [bLine] = await tx.select({ unitPrice: procTenderBidLines.unitPrice, discountPercent: procTenderBidLines.discountPercent }).from(procTenderBidLines).where(eq(procTenderBidLines.id, line.tenderBidLineId)).limit(1);
      const netUnitPrice = money(bLine!.unitPrice).times(money(1).minus(money(bLine!.discountPercent ?? 0).dividedBy(100)));
      const qty = money(line.awardedQty);
      await tx.insert(procAwardLines).values({
        id: newId(), awardId: id, tenderLineId: line.tenderLineId, supplierPartyId: line.supplierPartyId, tenderBidLineId: line.tenderBidLineId,
        awardedQty: toDb(qty), awardedUnitPrice: toDb(netUnitPrice), awardedTotal: toDb(qty.times(netUnitPrice))
      });
    }

    return id;
  });
}

export async function getAwardByTender(companyId: string, tenderId: string) {
  const [award] = await db
    .select({ id: procAwards.id, status: procAwards.status })
    .from(procAwards)
    .where(and(eq(procAwards.companyId, companyId), eq(procAwards.tenderId, tenderId)))
    .orderBy(desc(procAwards.createdAt))
    .limit(1);
  return award ?? null;
}

// RFQ VE Tender kaynaklı ödülleri TEK listede gösterir — kaynağın kendi adı/
// numarası iki AYRI (opsiyonel) sorguyla alınıp JS'te birleştirilir; tek bir
// polymorphic SQL JOIN yerine (drizzle'ın alias() API'si bu kod tabanında
// hiç kullanılmıyor, iki küçük sorgu + JS merge daha az riskli).
export async function listAwards(companyId: string) {
  const awards = await db.select({ id: procAwards.id, awardNo: procAwards.awardNo, status: procAwards.status, rfqId: procAwards.rfqId, tenderId: procAwards.tenderId, createdAt: procAwards.createdAt }).from(procAwards).where(eq(procAwards.companyId, companyId)).orderBy(desc(procAwards.createdAt));

  const rfqIds = [...new Set(awards.filter((a) => a.rfqId).map((a) => a.rfqId!))];
  const tenderIds = [...new Set(awards.filter((a) => a.tenderId).map((a) => a.tenderId!))];
  const [rfqRows, tenderRows] = await Promise.all([
    rfqIds.length > 0 ? db.select({ id: procRfqs.id, no: procRfqs.rfqNo, title: procRfqs.title }).from(procRfqs).where(inArray(procRfqs.id, rfqIds)) : [],
    tenderIds.length > 0 ? db.select({ id: procTenders.id, no: procTenders.tenderNo, title: procTenders.title }).from(procTenders).where(inArray(procTenders.id, tenderIds)) : []
  ]);
  const rfqById = new Map(rfqRows.map((r) => [r.id, r]));
  const tenderById = new Map(tenderRows.map((t) => [t.id, t]));

  return awards.map((a) => {
    const source = a.rfqId ? rfqById.get(a.rfqId) : tenderById.get(a.tenderId!);
    return { id: a.id, awardNo: a.awardNo, status: a.status, sourceType: a.rfqId ? 'RFQ' as const : 'TENDER' as const, sourceNo: source?.no ?? '—', sourceTitle: source?.title ?? '—', createdAt: a.createdAt };
  });
}

// RFQ detay ekranının "Ödül Oluştur" mu "Ödülü Görüntüle" mi göstereceğine
// karar verebilmesi için — CANCELLED/REJECTED hariç en son (varsa aktif)
// kaydı döner.
export async function getAwardByRfq(companyId: string, rfqId: string) {
  const [award] = await db
    .select({ id: procAwards.id, status: procAwards.status })
    .from(procAwards)
    .where(and(eq(procAwards.companyId, companyId), eq(procAwards.rfqId, rfqId)))
    .orderBy(desc(procAwards.createdAt))
    .limit(1);
  return award ?? null;
}

// Satır açıklaması/birimi RFQ VEYA Tender kalemlerinden gelebilir — TEK bir
// polymorphic JOIN yerine (listAwards'taki AYNI gerekçe) iki küçük sorgu +
// JS'te birleştirme: bir award'ın TÜM satırları aynı kaynak türünden olur
// (bir award ya rfqId'li ya tenderId'li), ama satır bazında hangi FK'nin
// dolu olduğuna bakmak yine de en güvenli yol.
export async function getAward(companyId: string, awardId: string) {
  const [award] = await db.select().from(procAwards).where(and(eq(procAwards.id, awardId), eq(procAwards.companyId, companyId))).limit(1);
  if (!award) throw new ProcurementError('Ödül kaydı bulunamadı.');

  const rawLines = await db.select().from(procAwardLines).where(eq(procAwardLines.awardId, awardId));

  const rfqLineIds = [...new Set(rawLines.filter((l) => l.rfqLineId).map((l) => l.rfqLineId!))];
  const tenderLineIds = [...new Set(rawLines.filter((l) => l.tenderLineId).map((l) => l.tenderLineId!))];
  const supplierIds = [...new Set(rawLines.map((l) => l.supplierPartyId))];

  const [rfqLineRows, tenderLineRows, supplierRows] = await Promise.all([
    rfqLineIds.length > 0 ? db.select({ id: procRfqLines.id, description: procRfqLines.description, unitCode: units.code }).from(procRfqLines).innerJoin(units, eq(units.id, procRfqLines.unitId)).where(inArray(procRfqLines.id, rfqLineIds)) : [],
    tenderLineIds.length > 0 ? db.select({ id: procTenderLines.id, description: procTenderLines.description, unitCode: units.code }).from(procTenderLines).innerJoin(units, eq(units.id, procTenderLines.unitId)).where(inArray(procTenderLines.id, tenderLineIds)) : [],
    supplierIds.length > 0 ? db.select({ id: parties.id, legalName: parties.legalName }).from(parties).where(inArray(parties.id, supplierIds)) : []
  ]);
  const rfqLineById = new Map(rfqLineRows.map((l) => [l.id, l]));
  const tenderLineById = new Map(tenderLineRows.map((l) => [l.id, l]));
  const supplierNameById = new Map(supplierRows.map((s) => [s.id, s.legalName]));

  const lines = rawLines.map((l) => {
    const detail = l.rfqLineId ? rfqLineById.get(l.rfqLineId) : tenderLineById.get(l.tenderLineId!);
    return {
      id: l.id, rfqLineId: l.rfqLineId, tenderLineId: l.tenderLineId,
      description: detail?.description ?? '—', unitCode: detail?.unitCode ?? '—',
      supplierPartyId: l.supplierPartyId, supplierName: supplierNameById.get(l.supplierPartyId) ?? '—',
      awardedQty: l.awardedQty, awardedUnitPrice: l.awardedUnitPrice, awardedTotal: l.awardedTotal
    };
  });

  const total = lines.reduce((acc, l) => acc.plus(money(l.awardedTotal)), money(0));
  const approval = await getApprovalInstance(companyId, 'PROCUREMENT_AWARD', awardId);

  return { award, lines, total: toDb(total), approval };
}

export async function cancelAward(companyId: string, awardId: string, userId: string): Promise<void> {
  const [award] = await db.select().from(procAwards).where(and(eq(procAwards.id, awardId), eq(procAwards.companyId, companyId))).limit(1);
  if (!award) throw new ProcurementError('Ödül kaydı bulunamadı.');
  if (award.status !== 'DRAFT' && award.status !== 'REVISION_REQUIRED') throw new ProcurementError('Yalnızca taslak veya değişiklik bekleyen bir ödül iptal edilebilir.');
  if (award.createdByUserId !== userId) throw new ProcurementError('Yalnızca ödülü oluşturan kişi iptal edebilir.');
  await db.update(procAwards).set({ status: 'CANCELLED' }).where(eq(procAwards.id, awardId));
}

// --- Onaya gönderme — workflow motorunu Requisition İLE AYNI desende
// başlatır (submitProcRequest'in atomikliği burada gerekmiyor: stok/bütçe
// yan etkisi Award'ın kendisinde YOK, o zaten Requisition aşamasında
// gerçekleşti — Award yalnızca "hangi tedarikçi" kararını onay akışına sokar). ---

export async function submitAward(companyId: string, awardId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [award] = await tx.select().from(procAwards).where(and(eq(procAwards.id, awardId), eq(procAwards.companyId, companyId))).limit(1);
    if (!award) throw new ProcurementError('Ödül kaydı bulunamadı.');
    if (award.status !== 'DRAFT' && award.status !== 'REVISION_REQUIRED') throw new ProcurementError(`${award.status} durumundaki bir ödül gönderilemez.`);

    const lines = await tx.select({ awardedTotal: procAwardLines.awardedTotal }).from(procAwardLines).where(eq(procAwardLines.awardId, awardId));
    if (lines.length === 0) throw new ProcurementError('Ödülün en az bir satırı olmalı.');
    const total = lines.reduce((acc, l) => acc.plus(money(l.awardedTotal)), money(0));

    await startApprovalInTx(tx, companyId, 'PROCUREMENT_AWARD', awardId, userId, { amount: total.toNumber() });
    await tx.update(procAwards).set({ status: 'SUBMITTED', submittedAt: new Date() }).where(eq(procAwards.id, awardId));
  });
}

export interface ActOnAwardStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnAwardStep(companyId: string, input: ActOnAwardStepInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new ProcurementError('Onay adımı bulunamadı.');
    // Güvenlik denetimi 2026-09-03, bulgu 2.7 — companyId filtresi eklendi.
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
    if (!instance || instance.documentType !== 'PROCUREMENT_AWARD') throw new ProcurementError('Bu adım bir satınalma ödülüne ait değil.');
    const awardId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    const [award] = await tx.select().from(procAwards).where(eq(procAwards.id, awardId)).limit(1);
    if (!award) return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(procAwards).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(procAwards.id, awardId));
      // madde 78-79 — onaylanan ödül, KAYNAĞINI (RFQ veya Tender, Faz 8B'nin
      // genellemesi) AWARDED durumuna taşır — bu Faz 5'in (PO) gerçek
      // tetikleyicisi. Bir award'ın rfqId/tenderId'sinden TAM BİRİ dolu
      // olduğu için (createAward/createAwardFromTender'ın kendi garantisi)
      // burada if/else yeterli, ikisi birden çalışmaz.
      if (award.rfqId) {
        await tx.update(procRfqs).set({ status: 'AWARDED' }).where(eq(procRfqs.id, award.rfqId));
      } else if (award.tenderId) {
        await tx.update(procTenders).set({ status: 'AWARDED' }).where(eq(procTenders.id, award.tenderId));
      }
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(procAwards).set({ status: newStatus, completedAt: new Date() }).where(eq(procAwards.id, awardId));
  });
}
