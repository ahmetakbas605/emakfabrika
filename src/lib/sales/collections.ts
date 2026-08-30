import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { salesCollections, salesInvoices } from '@/db/schema';
import { newId } from '@/lib/id';
import { money } from '@/lib/money';
import { postJournalInTx } from '@/lib/accounting';
import { getInvoice } from './invoices';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Tahsilat. lib/sales/invoices.ts:approveInvoice İLE AYNI
// opsiyonel muhasebe entegrasyonu deseni. Kasa/Banka modülünün KENDİ
// cash_transactions/bank_transactions tablolarına YAZMAZ (o modüllerin genel
// bir "tahsilat kaydet" API'si yok, yalnızca kendi hareketlerini yönetiyor)
// — bu, bilinçli bir kapsam sınırı: gerçek bir Kasa/Banka entegrasyonu
// (bu tahsilatın kasa/banka hareketi olarak da görünmesi) ayrı bir faz.

export interface CreateCollectionInput {
  invoiceId: string;
  collectionDate: string;
  amount: number;
  currencyCode: string;
  method: (typeof salesCollections.$inferInsert)['method'];
  journalDate?: string;
  cashOrBankAccountCode?: string;
  receivableAccountCode?: string;
}

export async function createCollection(companyId: string, createdByUserId: string, input: CreateCollectionInput): Promise<string> {
  if (input.amount <= 0) throw new SalesError('Tutar 0\'dan büyük olmalı.');

  return db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: salesInvoices.id, status: salesInvoices.status, invoiceNo: salesInvoices.invoiceNo }).from(salesInvoices).where(and(eq(salesInvoices.id, input.invoiceId), eq(salesInvoices.companyId, companyId))).limit(1);
    if (!invoice) throw new SalesError('Fatura bulunamadı.');
    if (invoice.status !== 'APPROVED') throw new SalesError('Yalnızca onaylanmış bir faturaya tahsilat kaydedilebilir.');

    const id = newId();
    await tx.insert(salesCollections).values({ id, companyId, invoiceId: input.invoiceId, collectionDate: input.collectionDate, amount: String(input.amount), currencyCode: input.currencyCode, method: input.method, createdByUserId });

    if (input.cashOrBankAccountCode && input.receivableAccountCode) {
      await postJournalInTx(tx, {
        companyId, journalDate: input.journalDate ?? input.collectionDate, documentType: 'SALES_COLLECTION', sourceType: 'SALES_COLLECTION', sourceId: id,
        description: `Tahsilat — ${invoice.invoiceNo}`, createdByUserId,
        lines: [{ accountCode: input.cashOrBankAccountCode, debit: money(input.amount) }, { accountCode: input.receivableAccountCode, credit: money(input.amount) }]
      });
    }

    return id;
  });
}

export async function listCollections(companyId: string, invoiceId?: string) {
  const conditions = invoiceId ? and(eq(salesCollections.companyId, companyId), eq(salesCollections.invoiceId, invoiceId)) : eq(salesCollections.companyId, companyId);
  return db.select().from(salesCollections).where(conditions).orderBy(desc(salesCollections.createdAt));
}

// madde (Tahsilat özeti) — bir faturanın ne kadarının tahsil edildiği,
// bakiyesi. TrialBalance İLE KARIŞTIRILMAMALI — bu yalnızca bu faturaya
// özel, basit bir toplama.
export async function getInvoiceCollectionSummary(companyId: string, invoiceId: string): Promise<{ invoiceTotal: string; collected: string; remaining: string }> {
  const collections = await listCollections(companyId, invoiceId);
  const collected = collections.reduce((acc, c) => acc.plus(money(c.amount)), money(0));

  const { lines } = await getInvoice(companyId, invoiceId);
  const invoiceTotal = lines.reduce((acc, l) => acc.plus(money(l.lineTotal).times(money(1).plus(money(l.taxRatePercent).dividedBy(100)))), money(0));

  return { invoiceTotal: invoiceTotal.toFixed(2), collected: collected.toFixed(2), remaining: invoiceTotal.minus(collected).toFixed(2) };
}
