import 'server-only';
import { eq, and, inArray } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { procPos, procPoLines, procReceipts, procReceiptLines, procVinvoices, procVinvoiceLines, units } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { recordStockMovementInTx } from '@/lib/warehouse';
import { postJournalInTx } from '@/lib/accounting';
import { ProcurementError } from './errors';

// Satınalma Faz 6 — Mal Kabul (Goods Receipt) + 3-Way Match. Faz 5'in
// PO'sunu TÜKETİR. Depo'nun (Faz 2A) stok hareket mantığını TEKRAR
// YAZMAZ — stok kartı bağlantısı varsa recordStockMovementInTx (madde
// zaten Depo'nun kendi optional-muhasebe deseni) DOĞRUDAN çağrılır.

async function requireReceivablePo(companyId: string, poId: string) {
  const [po] = await db.select().from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
  if (po.status !== 'ISSUED' && po.status !== 'ACKNOWLEDGED') throw new ProcurementError('Yalnızca gönderilmiş (ISSUED) veya onaylanmış (ACKNOWLEDGED) bir sipariş için mal kabul yapılabilir.');
  return po;
}

async function getReceivedQtyByPoLineInTx(tx: Tx, poLineIds: string[]): Promise<Map<string, ReturnType<typeof money>>> {
  if (poLineIds.length === 0) return new Map();
  const rows = await tx.select({ poLineId: procReceiptLines.poLineId, receivedQty: procReceiptLines.receivedQty }).from(procReceiptLines).where(inArray(procReceiptLines.poLineId, poLineIds));
  const map = new Map<string, ReturnType<typeof money>>();
  for (const row of rows) map.set(row.poLineId, (map.get(row.poLineId) ?? money(0)).plus(money(row.receivedQty)));
  return map;
}

// madde ~85-88 civarı (kısmi teslim) — bir PO satırı BİRDEN FAZLA mal
// kabul fişine dağılabilir (parça parça teslimat), toplamı PO miktarını
// AŞAMAZ.
export interface CreateReceiptLineInput {
  poLineId: string;
  receivedQty: number | string;
  warehouseId?: string;
  stockItemId?: string;
  counterAccountCode?: string; // stockItemId doluysa VE stok kartının accountingAccountId'si varsa fiş üretir
}

export interface CreateReceiptInput {
  receiptDate: string;
  notes?: string;
  lines: CreateReceiptLineInput[];
}

export async function createGoodsReceipt(companyId: string, poId: string, receivedByUserId: string, input: CreateReceiptInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir mal kabul satırı gerekli.');
  await requireReceivablePo(companyId, poId);

  const poLines = await db.select().from(procPoLines).where(eq(procPoLines.poId, poId));
  const poLineById = new Map(poLines.map((l) => [l.id, l]));
  for (const line of input.lines) {
    if (!poLineById.has(line.poLineId)) throw new ProcurementError('Mal kabul satırı bu siparişe ait olmayan bir kalemi referans ediyor.');
    if (money(line.receivedQty).lessThanOrEqualTo(0)) throw new ProcurementError('Kabul edilen miktar sıfırdan büyük olmalı.');
    if ((line.warehouseId && !line.stockItemId) || (!line.warehouseId && line.stockItemId)) {
      throw new ProcurementError('Depo ve stok kartı birlikte belirtilmeli (ikisi de veya hiçbiri).');
    }
  }

  return db.transaction(async (tx) => {
    const alreadyReceived = await getReceivedQtyByPoLineInTx(tx, [...new Set(input.lines.map((l) => l.poLineId))]);
    for (const line of input.lines) {
      const poLine = poLineById.get(line.poLineId)!;
      const totalAfter = (alreadyReceived.get(line.poLineId) ?? money(0)).plus(money(line.receivedQty));
      if (totalAfter.greaterThan(money(poLine.quantity))) {
        throw new ProcurementError(`"${poLine.description}" için kabul edilen toplam miktar (${totalAfter.toFixed(2)}) sipariş miktarını (${poLine.quantity}) aşamaz.`);
      }
      alreadyReceived.set(line.poLineId, totalAfter);
    }

    const receiptId = newId();
    const receiptNo = await nextDocumentNo(tx, companyId, 'GRN', 'GRN', new Date().getFullYear(), 6);
    await tx.insert(procReceipts).values({ id: receiptId, companyId, poId, receiptNo, receiptDate: input.receiptDate, notes: input.notes, receivedByUserId });

    for (const line of input.lines) {
      const poLine = poLineById.get(line.poLineId)!;
      const receiptLineId = newId();
      await tx.insert(procReceiptLines).values({
        id: receiptLineId, receiptId, poLineId: line.poLineId, receivedQty: toDb(line.receivedQty),
        warehouseId: line.warehouseId, stockItemId: line.stockItemId
      });

      if (line.warehouseId && line.stockItemId) {
        const { movementId } = await recordStockMovementInTx(tx, {
          companyId, warehouseId: line.warehouseId, stockItemId: line.stockItemId, movementType: 'IN',
          quantity: line.receivedQty, unitCost: poLine.unitPrice, counterAccountCode: line.counterAccountCode,
          description: `Mal kabul — ${poLine.description}`, transactionDate: input.receiptDate,
          sourceType: 'PROC_RECEIPT_LINE', sourceId: receiptLineId, createdByUserId: receivedByUserId
        });
        await tx.update(procReceiptLines).set({ stockMovementId: movementId }).where(eq(procReceiptLines.id, receiptLineId));
      }
    }

    return receiptId;
  });
}

export async function listReceiptsForPo(companyId: string, poId: string) {
  const receipts = await db.select().from(procReceipts).where(and(eq(procReceipts.companyId, companyId), eq(procReceipts.poId, poId)));
  const receiptIds = receipts.map((r) => r.id);
  const lines = receiptIds.length > 0
    ? await db.select({ id: procReceiptLines.id, receiptId: procReceiptLines.receiptId, poLineId: procReceiptLines.poLineId, receivedQty: procReceiptLines.receivedQty, description: procPoLines.description, unitCode: units.code })
        .from(procReceiptLines).innerJoin(procPoLines, eq(procPoLines.id, procReceiptLines.poLineId)).innerJoin(units, eq(units.id, procPoLines.unitId)).where(inArray(procReceiptLines.receiptId, receiptIds))
    : [];
  return receipts.map((r) => ({ ...r, lines: lines.filter((l) => l.receiptId === r.id) }));
}

export interface PoLineReceivingStatus {
  poLineId: string;
  description: string;
  unitCode: string;
  orderedQty: string;
  receivedQty: string;
  remainingQty: string;
}

export async function getPoReceivingStatus(companyId: string, poId: string): Promise<PoLineReceivingStatus[]> {
  await requireExistingPo(companyId, poId);
  const poLines = await db.select({ id: procPoLines.id, description: procPoLines.description, quantity: procPoLines.quantity, unitCode: units.code }).from(procPoLines).innerJoin(units, eq(units.id, procPoLines.unitId)).where(eq(procPoLines.poId, poId));
  const receivedByLine = await db.select({ poLineId: procReceiptLines.poLineId, receivedQty: procReceiptLines.receivedQty }).from(procReceiptLines).innerJoin(procPoLines, eq(procPoLines.id, procReceiptLines.poLineId)).where(eq(procPoLines.poId, poId));
  const receivedMap = new Map<string, ReturnType<typeof money>>();
  for (const row of receivedByLine) receivedMap.set(row.poLineId, (receivedMap.get(row.poLineId) ?? money(0)).plus(money(row.receivedQty)));

  return poLines.map((l) => {
    const received = receivedMap.get(l.id) ?? money(0);
    return { poLineId: l.id, description: l.description, unitCode: l.unitCode, orderedQty: l.quantity, receivedQty: toDb(received), remainingQty: toDb(money(l.quantity).minus(received)) };
  });
}

async function requireExistingPo(companyId: string, poId: string) {
  const [po] = await db.select({ id: procPos.id }).from(procPos).where(and(eq(procPos.id, poId), eq(procPos.companyId, companyId))).limit(1);
  if (!po) throw new ProcurementError('Sipariş bulunamadı.');
}

// --- Tedarikçi Faturası + 3-Way Match (madde ~89-95 civarı). Genel bir AP
// modülü DEĞİL — yalnızca PO'ya karşı miktar/fiyat eşleştirmesi için
// minimum veri (bkz. schema.ts'teki proc_vinvoices yorum). ---

const PRICE_VARIANCE_TOLERANCE_PERCENT = 2; // TODO: PROC_MATCH_TOLERANCE — şirket bazlı yapılandırılabilir değil, v1 sabit.

export interface CreateVendorInvoiceLineInput {
  poLineId: string;
  invoicedQty: number | string;
  invoicedUnitPrice: number | string;
}

export interface CreateVendorInvoiceInput {
  supplierInvoiceNo: string;
  invoiceDate: string;
  currencyCode: string;
  notes?: string;
  lines: CreateVendorInvoiceLineInput[];
}

// Miktar 3-way match'te SERBEST bırakılmaz, submitProcRequest'in bütçe
// kontrolü/Faz 4'ün RFQ-miktarı-aşamama kontrolüyle AYNI ilke: teslim
// alınmamış bir miktar faturalandırılamaz — bu bir "uyarı", sınırın
// KENDİSİ (miktar tarafında ayrıca bir tolerans/override YOK). Fiyat
// tarafı ise gerçek dünyada döviz/yuvarlama gibi küçük farklar taşıyabilir
// — o yüzden fiyat bir TOLERANS içinde MATCHED sayılır, aşarsa
// approveVendorInvoice REDDEDER (düzeltme veya PO revizyonu gerekir).
export async function createVendorInvoice(companyId: string, poId: string, createdByUserId: string, input: CreateVendorInvoiceInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir fatura satırı gerekli.');
  await requireExistingPo(companyId, poId);

  const poLines = await db.select().from(procPoLines).where(eq(procPoLines.poId, poId));
  const poLineById = new Map(poLines.map((l) => [l.id, l]));
  for (const line of input.lines) {
    if (!poLineById.has(line.poLineId)) throw new ProcurementError('Fatura satırı bu siparişe ait olmayan bir kalemi referans ediyor.');
  }

  return db.transaction(async (tx) => {
    const poLineIds = [...new Set(input.lines.map((l) => l.poLineId))];
    const receivedMap = await getReceivedQtyByPoLineInTx(tx, poLineIds);

    const existingInvoiceLines = await tx
      .select({ poLineId: procVinvoiceLines.poLineId, invoicedQty: procVinvoiceLines.invoicedQty })
      .from(procVinvoiceLines)
      .innerJoin(procVinvoices, eq(procVinvoices.id, procVinvoiceLines.invoiceId))
      .where(and(eq(procVinvoices.poId, poId), inArray(procVinvoices.status, ['DRAFT', 'APPROVED'])));
    const alreadyInvoiced = new Map<string, ReturnType<typeof money>>();
    for (const row of existingInvoiceLines) alreadyInvoiced.set(row.poLineId, (alreadyInvoiced.get(row.poLineId) ?? money(0)).plus(money(row.invoicedQty)));

    for (const line of input.lines) {
      const poLine = poLineById.get(line.poLineId)!;
      const received = receivedMap.get(line.poLineId) ?? money(0);
      const invoicedSoFar = alreadyInvoiced.get(line.poLineId) ?? money(0);
      const newTotal = invoicedSoFar.plus(money(line.invoicedQty));
      if (newTotal.greaterThan(received)) {
        throw new ProcurementError(`"${poLine.description}" için faturalandırılan toplam miktar (${newTotal.toFixed(2)}) teslim alınan miktarı (${received.toFixed(2)}) aşamaz.`);
      }
      alreadyInvoiced.set(line.poLineId, newTotal);
    }

    const invoiceId = newId();
    await tx.insert(procVinvoices).values({ id: invoiceId, companyId, poId, supplierInvoiceNo: input.supplierInvoiceNo, invoiceDate: input.invoiceDate, currencyCode: input.currencyCode, notes: input.notes, createdByUserId });

    for (const line of input.lines) {
      const qty = money(line.invoicedQty);
      const unitPrice = money(line.invoicedUnitPrice);
      await tx.insert(procVinvoiceLines).values({ id: newId(), invoiceId, poLineId: line.poLineId, invoicedQty: toDb(qty), invoicedUnitPrice: toDb(unitPrice), lineTotal: toDb(qty.times(unitPrice)) });
    }

    return invoiceId;
  });
}

export interface VendorInvoiceMatchLine {
  id: string;
  poLineId: string;
  description: string;
  unitCode: string;
  invoicedQty: string;
  invoicedUnitPrice: string;
  lineTotal: string;
  poUnitPrice: string;
  priceVariancePercent: string;
  withinTolerance: boolean;
}

export async function getVendorInvoice(companyId: string, invoiceId: string) {
  const [invoice] = await db.select().from(procVinvoices).where(and(eq(procVinvoices.id, invoiceId), eq(procVinvoices.companyId, companyId))).limit(1);
  if (!invoice) throw new ProcurementError('Fatura bulunamadı.');

  const rows = await db
    .select({ id: procVinvoiceLines.id, poLineId: procVinvoiceLines.poLineId, description: procPoLines.description, unitCode: units.code, invoicedQty: procVinvoiceLines.invoicedQty, invoicedUnitPrice: procVinvoiceLines.invoicedUnitPrice, lineTotal: procVinvoiceLines.lineTotal, poUnitPrice: procPoLines.unitPrice })
    .from(procVinvoiceLines)
    .innerJoin(procPoLines, eq(procPoLines.id, procVinvoiceLines.poLineId))
    .innerJoin(units, eq(units.id, procPoLines.unitId))
    .where(eq(procVinvoiceLines.invoiceId, invoiceId));

  const lines: VendorInvoiceMatchLine[] = rows.map((r) => {
    const poPrice = money(r.poUnitPrice);
    const variance = poPrice.isZero() ? money(0) : money(r.invoicedUnitPrice).minus(poPrice).abs().dividedBy(poPrice).times(100);
    return { ...r, priceVariancePercent: variance.toFixed(2), withinTolerance: variance.lessThanOrEqualTo(PRICE_VARIANCE_TOLERANCE_PERCENT) };
  });

  const total = lines.reduce((acc, l) => acc.plus(money(l.lineTotal)), money(0));
  const fullyMatched = lines.every((l) => l.withinTolerance);

  return { invoice, lines, total: toDb(total), fullyMatched, tolerancePercent: PRICE_VARIANCE_TOLERANCE_PERCENT };
}

export async function listVendorInvoicesForPo(companyId: string, poId: string) {
  return db.select().from(procVinvoices).where(and(eq(procVinvoices.companyId, companyId), eq(procVinvoices.poId, poId)));
}

export interface ApproveVendorInvoiceInput {
  journalDate?: string;
  clearingAccountCode?: string; // GR/IR clearing — mal kabulde kullanılan AYNI hesap kodu (madde)
  payableAccountCode?: string; // Satıcılar / Ödenecek hesap
}

// madde ~90 civarı — GR/IR clearing: mal kabulde (Depo Envanter Borç /
// Clearing Alacak) zaten fişlendi (opsiyonel). Burada TERSİ (Clearing Borç
// / Satıcılar Alacak) fişlenerek clearing hesabı kapanır. İkisi de
// OPSİYONEL — hesap kodları verilmezse yalnızca durum değişir, fiş
// üretilmez (Depo'nun counterAccountCode İLE AYNI opsiyonel-entegrasyon
// deseni).
export async function approveVendorInvoice(companyId: string, invoiceId: string, createdByUserId: string, input: ApproveVendorInvoiceInput = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(procVinvoices).where(and(eq(procVinvoices.id, invoiceId), eq(procVinvoices.companyId, companyId))).limit(1);
    if (!invoice) throw new ProcurementError('Fatura bulunamadı.');
    if (invoice.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir fatura onaylanabilir.');

    // getVendorInvoice'un AYNI eşleşme mantığı — burada tx üzerinden tekrar
    // edilir (db değil), onay kararı tx'in KENDİ tutarlı görüntüsüne göre
    // verilsin diye.
    const matchRows = await tx
      .select({ invoicedUnitPrice: procVinvoiceLines.invoicedUnitPrice, lineTotal: procVinvoiceLines.lineTotal, poUnitPrice: procPoLines.unitPrice })
      .from(procVinvoiceLines)
      .innerJoin(procPoLines, eq(procPoLines.id, procVinvoiceLines.poLineId))
      .where(eq(procVinvoiceLines.invoiceId, invoiceId));
    const total = matchRows.reduce((acc, r) => acc.plus(money(r.lineTotal)), money(0));
    const fullyMatched = matchRows.every((r) => {
      const poPrice = money(r.poUnitPrice);
      const variance = poPrice.isZero() ? money(0) : money(r.invoicedUnitPrice).minus(poPrice).abs().dividedBy(poPrice).times(100);
      return variance.lessThanOrEqualTo(PRICE_VARIANCE_TOLERANCE_PERCENT);
    });
    if (!fullyMatched) throw new ProcurementError(`Fatura, sipariş fiyatından %${PRICE_VARIANCE_TOLERANCE_PERCENT} toleransın dışında sapma içeriyor — onaylanamaz, satırlar düzeltilmeli.`);

    if (input.clearingAccountCode && input.payableAccountCode) {
      await postJournalInTx(tx, {
        companyId, journalDate: input.journalDate ?? invoice.invoiceDate, documentType: 'PROC_VENDOR_INVOICE',
        sourceType: 'PROC_VINVOICE', sourceId: invoiceId, description: `Tedarikçi faturası — ${invoice.supplierInvoiceNo}`,
        createdByUserId, lines: [{ accountCode: input.clearingAccountCode, debit: total }, { accountCode: input.payableAccountCode, credit: total }]
      });
    }

    await tx.update(procVinvoices).set({ status: 'APPROVED', approvedAt: new Date() }).where(eq(procVinvoices.id, invoiceId));
  });
}

export async function cancelVendorInvoice(companyId: string, invoiceId: string): Promise<void> {
  const [invoice] = await db.select({ status: procVinvoices.status }).from(procVinvoices).where(and(eq(procVinvoices.id, invoiceId), eq(procVinvoices.companyId, companyId))).limit(1);
  if (!invoice) throw new ProcurementError('Fatura bulunamadı.');
  if (invoice.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir fatura iptal edilebilir.');
  await db.update(procVinvoices).set({ status: 'CANCELLED' }).where(eq(procVinvoices.id, invoiceId));
}
