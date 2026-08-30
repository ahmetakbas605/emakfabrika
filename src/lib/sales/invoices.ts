import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { salesInvoices, salesInvoiceLines, salesOrders, salesOrderLines, parties, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { postJournalInTx } from '@/lib/accounting';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Fatura. lib/procurement/receiving.ts:approveVendorInvoice
// İLE AYNI "opsiyonel muhasebe entegrasyonu" deseni (yalnızca hesap kodları
// verilirse fiş üretir).

export interface InvoiceLineInput {
  orderLineId?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent?: number;
}

export interface CreateInvoiceInput {
  orderId?: string;
  partyId: string;
  invoiceDate: string;
  currencyCode: string;
  lines: InvoiceLineInput[];
}

export async function createInvoice(companyId: string, createdByUserId: string, input: CreateInvoiceInput): Promise<string> {
  if (input.lines.length === 0) throw new SalesError('Faturada en az bir kalem olmalı.');

  return db.transaction(async (tx) => {
    const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.partyId), eq(parties.companyId, companyId))).limit(1);
    if (!party) throw new SalesError('Cari kartı bulunamadı.');

    const id = newId();
    const invoiceNo = await nextDocumentNo(tx, companyId, 'SLSI', 'FAT', new Date().getFullYear(), 6);
    await tx.insert(salesInvoices).values({ id, companyId, invoiceNo, orderId: input.orderId, partyId: input.partyId, invoiceDate: input.invoiceDate, currencyCode: input.currencyCode, createdByUserId });

    for (const line of input.lines) {
      const [product] = await tx.select({ id: products.id, taxRatePercent: products.taxRatePercent }).from(products).where(and(eq(products.id, line.productId), eq(products.companyId, companyId))).limit(1);
      if (!product) throw new SalesError('Ürün bulunamadı.');

      if (line.orderLineId) {
        const [orderLine] = await tx.select({ quantity: salesOrderLines.quantity, invoicedQuantity: salesOrderLines.invoicedQuantity }).from(salesOrderLines).where(eq(salesOrderLines.id, line.orderLineId)).limit(1);
        if (!orderLine) throw new SalesError('Sipariş kalemi bulunamadı.');
        const remaining = money(orderLine.quantity).minus(orderLine.invoicedQuantity);
        if (money(line.quantity).greaterThan(remaining)) throw new SalesError(`Faturalanan miktar (${line.quantity}), kalan miktardan (${remaining.toFixed(2)}) fazla olamaz.`);
      }

      await tx.insert(salesInvoiceLines).values({
        id: newId(), invoiceId: id, orderLineId: line.orderLineId, productId: line.productId, quantity: toDb(line.quantity), unitPrice: toDb(line.unitPrice),
        taxRatePercent: toDb(line.taxRatePercent ?? product.taxRatePercent ?? 0), lineTotal: toDb(money(line.quantity).times(line.unitPrice))
      });
    }

    return id;
  });
}

export async function listInvoices(companyId: string, partyId?: string) {
  const conditions = partyId ? and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.partyId, partyId)) : eq(salesInvoices.companyId, companyId);
  return db
    .select({ id: salesInvoices.id, invoiceNo: salesInvoices.invoiceNo, partyId: salesInvoices.partyId, partyName: parties.legalName, invoiceDate: salesInvoices.invoiceDate, status: salesInvoices.status, currencyCode: salesInvoices.currencyCode })
    .from(salesInvoices)
    .innerJoin(parties, eq(parties.id, salesInvoices.partyId))
    .where(conditions);
}

export async function getInvoice(companyId: string, invoiceId: string) {
  const [invoice] = await db.select().from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.companyId, companyId))).limit(1);
  if (!invoice) throw new SalesError('Fatura bulunamadı.');
  const lines = await db
    .select({ id: salesInvoiceLines.id, productId: salesInvoiceLines.productId, productName: products.name, quantity: salesInvoiceLines.quantity, unitPrice: salesInvoiceLines.unitPrice, taxRatePercent: salesInvoiceLines.taxRatePercent, lineTotal: salesInvoiceLines.lineTotal })
    .from(salesInvoiceLines)
    .innerJoin(products, eq(products.id, salesInvoiceLines.productId))
    .where(eq(salesInvoiceLines.invoiceId, invoiceId));
  return { invoice, lines };
}

export interface ApproveInvoiceInput {
  journalDate?: string;
  revenueAccountCode?: string;
  receivableAccountCode?: string;
  taxAccountCode?: string; // opsiyonel — verilmezse KDV ayrı fişlenmez (madde 92'nin dokümante edilmiş sadeleştirmesi)
}

export async function approveInvoice(companyId: string, invoiceId: string, createdByUserId: string, input: ApproveInvoiceInput = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.companyId, companyId))).limit(1);
    if (!invoice) throw new SalesError('Fatura bulunamadı.');
    if (invoice.status !== 'DRAFT') throw new SalesError('Yalnızca taslak (DRAFT) bir fatura onaylanabilir.');

    const lines = await tx.select({ orderLineId: salesInvoiceLines.orderLineId, lineTotal: salesInvoiceLines.lineTotal, taxRatePercent: salesInvoiceLines.taxRatePercent, quantity: salesInvoiceLines.quantity }).from(salesInvoiceLines).where(eq(salesInvoiceLines.invoiceId, invoiceId));
    const netTotal = lines.reduce((acc, l) => acc.plus(money(l.lineTotal)), money(0));
    const taxTotal = lines.reduce((acc, l) => acc.plus(money(l.lineTotal).times(l.taxRatePercent).dividedBy(100)), money(0));

    if (input.revenueAccountCode && input.receivableAccountCode) {
      const grossTotal = netTotal.plus(input.taxAccountCode ? taxTotal : money(0));
      const journalLines = input.taxAccountCode
        ? [{ accountCode: input.receivableAccountCode, debit: grossTotal }, { accountCode: input.revenueAccountCode, credit: netTotal }, { accountCode: input.taxAccountCode, credit: taxTotal }]
        : [{ accountCode: input.receivableAccountCode, debit: netTotal }, { accountCode: input.revenueAccountCode, credit: netTotal }];
      await postJournalInTx(tx, { companyId, journalDate: input.journalDate ?? invoice.invoiceDate, documentType: 'SALES_INVOICE', sourceType: 'SALES_INVOICE', sourceId: invoiceId, description: `Satış faturası — ${invoice.invoiceNo}`, createdByUserId, lines: journalLines });
    }

    for (const line of lines) {
      if (!line.orderLineId) continue;
      const [orderLine] = await tx.select({ invoicedQuantity: salesOrderLines.invoicedQuantity }).from(salesOrderLines).where(eq(salesOrderLines.id, line.orderLineId)).limit(1);
      if (orderLine) await tx.update(salesOrderLines).set({ invoicedQuantity: toDb(money(orderLine.invoicedQuantity).plus(line.quantity)) }).where(eq(salesOrderLines.id, line.orderLineId));
    }

    await tx.update(salesInvoices).set({ status: 'APPROVED', approvedAt: new Date() }).where(eq(salesInvoices.id, invoiceId));

    if (invoice.orderId) {
      const allLines = await tx.select({ quantity: salesOrderLines.quantity, invoicedQuantity: salesOrderLines.invoicedQuantity }).from(salesOrderLines).where(eq(salesOrderLines.orderId, invoice.orderId));
      const fullyInvoiced = allLines.every((l) => money(l.invoicedQuantity).greaterThanOrEqualTo(l.quantity));
      if (fullyInvoiced) await tx.update(salesOrders).set({ status: 'INVOICED' }).where(eq(salesOrders.id, invoice.orderId));
    }
  });
}

export async function cancelInvoice(companyId: string, invoiceId: string): Promise<void> {
  const [invoice] = await db.select({ status: salesInvoices.status }).from(salesInvoices).where(and(eq(salesInvoices.id, invoiceId), eq(salesInvoices.companyId, companyId))).limit(1);
  if (!invoice) throw new SalesError('Fatura bulunamadı.');
  if (invoice.status !== 'DRAFT') throw new SalesError('Yalnızca taslak (DRAFT) bir fatura iptal edilebilir.');
  await db.update(salesInvoices).set({ status: 'CANCELLED' }).where(eq(salesInvoices.id, invoiceId));
}
