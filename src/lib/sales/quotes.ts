import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { salesQuotes, salesQuoteLines, parties, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Teklif (Quote). lineTotal her zaman VERGİSİZ net tutar
// (miktar × birim fiyat × (1-iskonto%)) — accounting.test.ts'in senaryolarıyla
// TUTARLI: KDV ayrı bir kalem/hesaplama, lineTotal'e GÖMÜLMEZ.

export interface QuoteLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRatePercent?: number;
}

export interface CreateQuoteInput {
  partyId: string;
  opportunityId?: string;
  quoteDate: string;
  validUntil?: string;
  currencyCode: string;
  lines: QuoteLineInput[];
}

function computeLineTotal(line: QuoteLineInput): ReturnType<typeof money> {
  const gross = money(line.quantity).times(line.unitPrice);
  const discount = line.discountPercent ? gross.times(line.discountPercent).dividedBy(100) : money(0);
  return gross.minus(discount);
}

export async function createQuote(companyId: string, createdByUserId: string, input: CreateQuoteInput): Promise<string> {
  if (input.lines.length === 0) throw new SalesError('Teklifte en az bir kalem olmalı.');

  return db.transaction(async (tx) => {
    const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.partyId), eq(parties.companyId, companyId))).limit(1);
    if (!party) throw new SalesError('Cari kartı bulunamadı.');

    const id = newId();
    const quoteNo = await nextDocumentNo(tx, companyId, 'SLSQ', 'TKL', new Date().getFullYear(), 6);
    await tx.insert(salesQuotes).values({
      id, companyId, quoteNo, partyId: input.partyId, opportunityId: input.opportunityId, quoteDate: input.quoteDate,
      validUntil: input.validUntil, currencyCode: input.currencyCode, createdByUserId
    });

    for (const line of input.lines) {
      const [product] = await tx.select({ id: products.id, taxRatePercent: products.taxRatePercent }).from(products).where(and(eq(products.id, line.productId), eq(products.companyId, companyId))).limit(1);
      if (!product) throw new SalesError('Ürün bulunamadı.');
      await tx.insert(salesQuoteLines).values({
        id: newId(), quoteId: id, productId: line.productId, quantity: toDb(line.quantity), unitPrice: toDb(line.unitPrice),
        discountPercent: line.discountPercent === undefined ? undefined : toDb(line.discountPercent),
        taxRatePercent: toDb(line.taxRatePercent ?? product.taxRatePercent ?? 0),
        lineTotal: toDb(computeLineTotal(line))
      });
    }

    return id;
  });
}

export async function listQuotes(companyId: string, partyId?: string) {
  const conditions = partyId ? and(eq(salesQuotes.companyId, companyId), eq(salesQuotes.partyId, partyId)) : eq(salesQuotes.companyId, companyId);
  return db
    .select({ id: salesQuotes.id, quoteNo: salesQuotes.quoteNo, partyId: salesQuotes.partyId, partyName: parties.legalName, quoteDate: salesQuotes.quoteDate, status: salesQuotes.status, currencyCode: salesQuotes.currencyCode, createdAt: salesQuotes.createdAt })
    .from(salesQuotes)
    .innerJoin(parties, eq(parties.id, salesQuotes.partyId))
    .where(conditions)
    .orderBy(desc(salesQuotes.createdAt));
}

export async function getQuote(companyId: string, quoteId: string) {
  const [quote] = await db.select().from(salesQuotes).where(and(eq(salesQuotes.id, quoteId), eq(salesQuotes.companyId, companyId))).limit(1);
  if (!quote) throw new SalesError('Teklif bulunamadı.');
  const lines = await db
    .select({ id: salesQuoteLines.id, productId: salesQuoteLines.productId, productName: products.name, quantity: salesQuoteLines.quantity, unitPrice: salesQuoteLines.unitPrice, discountPercent: salesQuoteLines.discountPercent, taxRatePercent: salesQuoteLines.taxRatePercent, lineTotal: salesQuoteLines.lineTotal })
    .from(salesQuoteLines)
    .innerJoin(products, eq(products.id, salesQuoteLines.productId))
    .where(eq(salesQuoteLines.quoteId, quoteId));
  return { quote, lines };
}

export async function setQuoteStatus(companyId: string, quoteId: string, status: (typeof salesQuotes.$inferInsert)['status']): Promise<void> {
  const [quote] = await db.select({ status: salesQuotes.status }).from(salesQuotes).where(and(eq(salesQuotes.id, quoteId), eq(salesQuotes.companyId, companyId))).limit(1);
  if (!quote) throw new SalesError('Teklif bulunamadı.');
  if (quote.status === 'CONVERTED') throw new SalesError('Siparişe dönüştürülmüş bir teklifin durumu değiştirilemez.');
  await db.update(salesQuotes).set({ status }).where(eq(salesQuotes.id, quoteId));
}

// lib/sales/orders.ts:createOrderFromQuote'un TEK transaction'da teklifi
// CONVERTED'a çevirip aynı satırları siparişe kopyalaması için — parties.ts:
// createPartyInTx İLE AYNI ...InTx deseni.
export async function markQuoteConvertedInTx(tx: Tx, companyId: string, quoteId: string): Promise<void> {
  const [quote] = await tx.select({ status: salesQuotes.status }).from(salesQuotes).where(and(eq(salesQuotes.id, quoteId), eq(salesQuotes.companyId, companyId))).limit(1);
  if (!quote) throw new SalesError('Teklif bulunamadı.');
  if (quote.status !== 'ACCEPTED') throw new SalesError('Yalnızca kabul edilmiş (ACCEPTED) bir teklif siparişe dönüştürülebilir.');
  await tx.update(salesQuotes).set({ status: 'CONVERTED' }).where(eq(salesQuotes.id, quoteId));
}
