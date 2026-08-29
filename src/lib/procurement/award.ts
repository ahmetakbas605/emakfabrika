import 'server-only';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { procAwards, procAwardLines, procRfqs, procRfqLines, procQuotations, procQuotationLines, parties, units, approvalSteps, approvalInstances } from '@/db/schema';
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

export async function listAwards(companyId: string) {
  return db
    .select({ id: procAwards.id, awardNo: procAwards.awardNo, status: procAwards.status, rfqId: procAwards.rfqId, rfqNo: procRfqs.rfqNo, rfqTitle: procRfqs.title, createdAt: procAwards.createdAt })
    .from(procAwards)
    .innerJoin(procRfqs, eq(procRfqs.id, procAwards.rfqId))
    .where(eq(procAwards.companyId, companyId))
    .orderBy(desc(procAwards.createdAt));
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

export async function getAward(companyId: string, awardId: string) {
  const [award] = await db.select().from(procAwards).where(and(eq(procAwards.id, awardId), eq(procAwards.companyId, companyId))).limit(1);
  if (!award) throw new ProcurementError('Ödül kaydı bulunamadı.');

  const lines = await db
    .select({
      id: procAwardLines.id, rfqLineId: procAwardLines.rfqLineId, description: procRfqLines.description, unitCode: units.code,
      supplierPartyId: procAwardLines.supplierPartyId, supplierName: parties.legalName,
      awardedQty: procAwardLines.awardedQty, awardedUnitPrice: procAwardLines.awardedUnitPrice, awardedTotal: procAwardLines.awardedTotal
    })
    .from(procAwardLines)
    .innerJoin(procRfqLines, eq(procRfqLines.id, procAwardLines.rfqLineId))
    .innerJoin(units, eq(units.id, procRfqLines.unitId))
    .innerJoin(parties, eq(parties.id, procAwardLines.supplierPartyId))
    .where(eq(procAwardLines.awardId, awardId));

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
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(eq(approvalInstances.id, step.instanceId)).limit(1);
    if (!instance || instance.documentType !== 'PROCUREMENT_AWARD') throw new ProcurementError('Bu adım bir satınalma ödülüne ait değil.');
    const awardId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    const [award] = await tx.select().from(procAwards).where(eq(procAwards.id, awardId)).limit(1);
    if (!award) return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(procAwards).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(procAwards.id, awardId));
      // madde 78-79 — onaylanan ödül RFQ'yu AWARDED durumuna taşır, bu
      // Faz 5'in (PO/Sözleşme) gerçek tetikleyicisi olacak (henüz yok).
      await tx.update(procRfqs).set({ status: 'AWARDED' }).where(eq(procRfqs.id, award.rfqId));
      return;
    }

    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(procAwards).set({ status: newStatus, completedAt: new Date() }).where(eq(procAwards.id, awardId));
  });
}
