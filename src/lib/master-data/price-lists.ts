import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { priceLists, priceListItems, products, currencies, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { CoreError } from '@/lib/core/errors';

export interface CreatePriceListInput {
  name: string;
  currencyCode: string;
  validFrom?: string;
  validTo?: string;
  partyId?: string; // madde 30 — doluysa müşteriye özel fiyat listesi
}

export async function createPriceList(companyId: string, input: CreatePriceListInput): Promise<string> {
  const [currency] = await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.code, input.currencyCode)).limit(1);
  if (!currency) throw new CoreError('Para birimi bulunamadı.');
  if (input.partyId) {
    const [party] = await db.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.partyId), eq(parties.companyId, companyId))).limit(1);
    if (!party) throw new CoreError('Cari kartı bulunamadı.');
  }

  const id = newId();
  await db.insert(priceLists).values({
    id,
    companyId,
    name: input.name,
    currencyCode: input.currencyCode,
    validFrom: input.validFrom,
    validTo: input.validTo,
    partyId: input.partyId
  });
  return id;
}

export async function listPriceLists(companyId: string) {
  return db
    .select({ id: priceLists.id, name: priceLists.name, currencyCode: priceLists.currencyCode, validFrom: priceLists.validFrom, validTo: priceLists.validTo, partyId: priceLists.partyId, partyName: parties.legalName })
    .from(priceLists)
    .leftJoin(parties, eq(parties.id, priceLists.partyId))
    .where(and(eq(priceLists.companyId, companyId), eq(priceLists.active, true)));
}

export async function getPriceList(companyId: string, priceListId: string) {
  const [list] = await db.select().from(priceLists).where(and(eq(priceLists.id, priceListId), eq(priceLists.companyId, companyId))).limit(1);
  if (!list) throw new CoreError('Fiyat listesi bulunamadı.');

  const items = await db
    .select({ id: priceListItems.id, productId: priceListItems.productId, productSku: products.sku, productName: products.name, price: priceListItems.price, discountPercent: priceListItems.discountPercent, taxInclusive: priceListItems.taxInclusive })
    .from(priceListItems)
    .innerJoin(products, eq(products.id, priceListItems.productId))
    .where(eq(priceListItems.priceListId, priceListId));

  return { list, items };
}

export interface SetPriceListItemInput {
  productId: string;
  price: number | string;
  discountPercent?: number | string;
  taxInclusive?: boolean;
}

// Aynı ürün için ikinci kez çağrılırsa fiyatı GÜNCELLER (upsert) — bir fiyat
// listesinde bir ürünün birden fazla satırı olmasının anlamı yok.
export async function setPriceListItem(companyId: string, priceListId: string, input: SetPriceListItemInput): Promise<void> {
  const [list] = await db.select({ id: priceLists.id }).from(priceLists).where(and(eq(priceLists.id, priceListId), eq(priceLists.companyId, companyId))).limit(1);
  if (!list) throw new CoreError('Fiyat listesi bulunamadı.');
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.companyId, companyId))).limit(1);
  if (!product) throw new CoreError('Ürün bulunamadı.');

  await db
    .insert(priceListItems)
    .values({
      id: newId(),
      priceListId,
      productId: input.productId,
      price: toDb(input.price),
      discountPercent: input.discountPercent === undefined ? undefined : toDb(input.discountPercent),
      taxInclusive: input.taxInclusive ?? false
    })
    .onDuplicateKeyUpdate({
      set: {
        price: toDb(input.price),
        discountPercent: input.discountPercent === undefined ? undefined : toDb(input.discountPercent),
        taxInclusive: input.taxInclusive ?? false
      }
    });
}
