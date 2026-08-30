import 'server-only';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { procPos, procPoLines, procAwards, procAwardLines, procRfqs, procRfqLines, procTenders, procTenderLines, units, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { listAttachments, uploadAttachment, type UploadAttachmentInput } from '@/lib/documents/attachments';
import { ProcurementError } from './errors';

// Satınalma Faz 5 — Purchase Order (madde 83-95 civarı). Onaylanmış bir
// Award'ın (Faz 4) KENDİSİNİ TÜKETİR — Award "hangi tedarikçi, ne kadar,
// hangi fiyat" kararını zaten verdi ve onaylattı; PO bu kararı TEDARİKÇİYE
// GÖNDERİLEN resmi kağıda çevirir. Bu yüzden PO'nun KENDİ bir onay akışı
// YOK — Award'ın onayı zaten yeterli, ikinci bir onay gereksiz sürtünme
// olurdu (bu bilinçli karar madde 78-79'un "onaylanan ödül → sipariş"
// akışıyla tutarlı).

// madde 79-80 civarı — bir Award BİRDEN FAZLA tedarikçiye bölünmüşse (Faz
// 4'ün split ödül desteği), her tedarikçi KENDİ PO'sunu alır: bir
// tedarikçiye giden kağıt başka bir tedarikçinin fiyatını GÖRMEMELİ.
export async function createPurchaseOrdersFromAward(companyId: string, awardId: string, createdByUserId: string): Promise<string[]> {
  const [award] = await db.select().from(procAwards).where(and(eq(procAwards.id, awardId), eq(procAwards.companyId, companyId))).limit(1);
  if (!award) throw new ProcurementError('Ödül kaydı bulunamadı.');
  if (award.status !== 'APPROVED') throw new ProcurementError('Yalnızca onaylanmış (APPROVED) bir ödül için sipariş oluşturulabilir.');

  // Faz 8C — Award'ın kaynağı RFQ VEYA Tender olabilir (Faz 8B'nin
  // genellemesi). Teslimat/ödeme başlığı ve satır açıklaması/birimi İKİ
  // AYRI küçük sorguyla alınıp JS'te birleştirilir — award.ts:getAward'ın
  // AYNI "polymorphic JOIN yerine iki sorgu" tercihi (drizzle alias() bu
  // kod tabanında hiç kullanılmıyor).
  const header = award.rfqId
    ? await db.select({ deliveryLocation: procRfqs.deliveryLocation, paymentTerms: procRfqs.paymentTerms, warrantyRequirement: procRfqs.warrantyRequirement }).from(procRfqs).where(eq(procRfqs.id, award.rfqId)).limit(1).then((r) => r[0])
    : await db.select({ deliveryLocation: procTenders.deliveryLocation, paymentTerms: procTenders.paymentTerms, warrantyRequirement: procTenders.warrantyRequirement }).from(procTenders).where(eq(procTenders.id, award.tenderId!)).limit(1).then((r) => r[0]);

  const rawAwardLines = await db.select().from(procAwardLines).where(eq(procAwardLines.awardId, awardId));
  const rfqLineIds = [...new Set(rawAwardLines.filter((l) => l.rfqLineId).map((l) => l.rfqLineId!))];
  const tenderLineIds = [...new Set(rawAwardLines.filter((l) => l.tenderLineId).map((l) => l.tenderLineId!))];
  const [rfqLineRows, tenderLineRows] = await Promise.all([
    rfqLineIds.length > 0 ? db.select({ id: procRfqLines.id, description: procRfqLines.description, unitId: procRfqLines.unitId }).from(procRfqLines).where(inArray(procRfqLines.id, rfqLineIds)) : [],
    tenderLineIds.length > 0 ? db.select({ id: procTenderLines.id, description: procTenderLines.description, unitId: procTenderLines.unitId }).from(procTenderLines).where(inArray(procTenderLines.id, tenderLineIds)) : []
  ]);
  const rfqLineById = new Map(rfqLineRows.map((l) => [l.id, l]));
  const tenderLineById = new Map(tenderLineRows.map((l) => [l.id, l]));

  const awardLines = rawAwardLines.map((l) => {
    const detail = l.rfqLineId ? rfqLineById.get(l.rfqLineId) : tenderLineById.get(l.tenderLineId!);
    return { id: l.id, supplierPartyId: l.supplierPartyId, awardedQty: l.awardedQty, awardedUnitPrice: l.awardedUnitPrice, awardedTotal: l.awardedTotal, description: detail?.description ?? '—', unitId: detail?.unitId ?? '' };
  });

  // Zaten bir PO satırına dönüşmüş award satırları HARİÇ (madde
  // proc_rfq_lines.srcRequestLineId ile AYNI "yalnızca bir kez" ilkesi —
  // burada geri-işaretçi yerine proc_po_lines.awardLineId'nin kendi
  // UNIQUE'i üzerinden, eldeki listeyi bir LEFT JOIN/NOT IN ile filtreleyerek).
  const alreadyPoLines = await db.select({ awardLineId: procPoLines.awardLineId }).from(procPoLines).innerJoin(procPos, eq(procPos.id, procPoLines.poId)).where(eq(procPos.awardId, awardId));
  const alreadyUsed = new Set(alreadyPoLines.map((l) => l.awardLineId));
  const pending = awardLines.filter((l) => !alreadyUsed.has(l.id));
  if (pending.length === 0) throw new ProcurementError('Bu ödülün tüm satırları zaten bir siparişe dönüştürülmüş.');

  const bySupplier = new Map<string, typeof pending>();
  for (const line of pending) {
    const arr = bySupplier.get(line.supplierPartyId) ?? [];
    arr.push(line);
    bySupplier.set(line.supplierPartyId, arr);
  }

  const currencyCode = 'TRY'; // TODO: PROC_PO_CURRENCY — Award/RFQ şu an tek bir para birimi kaydetmiyor (teklif bazında), v1 varsayılan TRY.

  return db.transaction(async (tx) => {
    const createdIds: string[] = [];
    for (const [supplierPartyId, lines] of bySupplier.entries()) {
      const id = newId();
      const poNo = await nextDocumentNo(tx, companyId, 'PO', 'PO', new Date().getFullYear(), 6);
      await tx.insert(procPos).values({
        id, companyId, awardId, supplierPartyId, poNo, status: 'DRAFT', currencyCode,
        deliveryLocation: header?.deliveryLocation ?? '', paymentTerms: header?.paymentTerms ?? '', warrantyRequirement: header?.warrantyRequirement ?? '',
        createdByUserId
      });
      for (const line of lines) {
        await tx.insert(procPoLines).values({
          id: newId(), poId: id, awardLineId: line.id, description: line.description, quantity: line.awardedQty,
          unitId: line.unitId, unitPrice: line.awardedUnitPrice, lineTotal: line.awardedTotal
        });
      }
      createdIds.push(id);
    }
    return createdIds;
  });
}

export async function listPurchaseOrdersForAward(companyId: string, awardId: string) {
  return db
    .select({ id: procPos.id, poNo: procPos.poNo, status: procPos.status, supplierPartyId: procPos.supplierPartyId, supplierName: parties.legalName, createdAt: procPos.createdAt })
    .from(procPos)
    .innerJoin(parties, eq(parties.id, procPos.supplierPartyId))
    .where(and(eq(procPos.companyId, companyId), eq(procPos.awardId, awardId)))
    .orderBy(desc(procPos.createdAt));
}

export async function listPurchaseOrders(companyId: string) {
  return db
    .select({ id: procPos.id, poNo: procPos.poNo, status: procPos.status, supplierName: parties.legalName, createdAt: procPos.createdAt })
    .from(procPos)
    .innerJoin(parties, eq(parties.id, procPos.supplierPartyId))
    .where(eq(procPos.companyId, companyId))
    .orderBy(desc(procPos.createdAt));
}

export async function getPurchaseOrder(companyId: string, poId: string) {
  const [po] = await db.select().from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');

  const [supplier] = await db.select({ legalName: parties.legalName }).from(parties).where(eq(parties.id, po.supplierPartyId)).limit(1);

  const lines = await db
    .select({ id: procPoLines.id, description: procPoLines.description, quantity: procPoLines.quantity, unitCode: units.code, unitPrice: procPoLines.unitPrice, lineTotal: procPoLines.lineTotal })
    .from(procPoLines)
    .innerJoin(units, eq(units.id, procPoLines.unitId))
    .where(eq(procPoLines.poId, poId));

  const total = lines.reduce((acc, l) => acc.plus(money(l.lineTotal)), money(0));
  const attachments = await listAttachments(companyId, 'PROC_PO', poId);

  return { po, supplierName: supplier?.legalName ?? '—', lines, total: toDb(total), attachments };
}

export async function issuePurchaseOrder(companyId: string, poId: string): Promise<void> {
  const [po] = await db.select({ status: procPos.status }).from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
  if (po.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir sipariş gönderilebilir.');
  await db.update(procPos).set({ status: 'ISSUED', issuedAt: new Date() }).where(eq(procPos.id, poId));
}

// madde 59 civarındaki "tedarikçi portalı yok" ilkesiyle AYNI gerekçe —
// tedarikçinin siparişi onayladığı bilgisi telefon/e-posta ile alınıp
// BİR satınalma kullanıcısı tarafından elle işaretlenir.
export async function acknowledgePurchaseOrder(companyId: string, poId: string): Promise<void> {
  const [po] = await db.select({ status: procPos.status }).from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
  if (po.status !== 'ISSUED') throw new ProcurementError('Yalnızca gönderilmiş (ISSUED) bir sipariş onaylandı olarak işaretlenebilir.');
  await db.update(procPos).set({ status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }).where(eq(procPos.id, poId));
}

export async function cancelPurchaseOrder(companyId: string, poId: string): Promise<void> {
  const [po] = await db.select({ status: procPos.status }).from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
  if (po.status !== 'DRAFT' && po.status !== 'ISSUED') throw new ProcurementError('Onaylanmış (ACKNOWLEDGED) veya zaten iptal edilmiş bir sipariş iptal edilemez.');
  await db.update(procPos).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(eq(procPos.id, poId));
}

// madde 25-28 — "sözleşme" ayrı bir şema DEĞİL, document_attachments'ın
// (Faz 0) PO'ya bağlı bir kullanımı. İmzalı sözleşme/şartname dosyası
// buraya yüklenir.
export async function addPoAttachment(companyId: string, poId: string, input: Omit<UploadAttachmentInput, 'entityType' | 'entityId'>): Promise<string> {
  const [po] = await db.select({ id: procPos.id }).from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
  return uploadAttachment(companyId, { ...input, entityType: 'PROC_PO', entityId: poId });
}

// Award detay ekranının "Sipariş Oluştur" mu göstereceğine karar
// verebilmesi için — henüz PO'ya dönüşmemiş en az bir award satırı var mı.
export async function hasUnconvertedAwardLines(companyId: string, awardId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: procAwardLines.id })
    .from(procAwardLines)
    .leftJoin(procPoLines, eq(procPoLines.awardLineId, procAwardLines.id))
    .where(and(eq(procAwardLines.awardId, awardId), isNull(procPoLines.id)))
    .limit(1);
  return !!row;
}
