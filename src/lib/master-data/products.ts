import 'server-only';
import { eq, and, or, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { products, productBarcodes, productCats, brands, productSuppliers, units, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { CoreError } from '@/lib/core/errors';

// --- Kategori / Marka — bağımsız küçük master'lar (madde 27-28). ---

export interface CreateProductCatInput {
  code: string;
  name: string;
  parentCategoryId?: string;
}

export async function createProductCat(companyId: string, input: CreateProductCatInput): Promise<string> {
  if (input.parentCategoryId) {
    const [parent] = await db.select({ id: productCats.id }).from(productCats).where(and(eq(productCats.id, input.parentCategoryId), eq(productCats.companyId, companyId))).limit(1);
    if (!parent) throw new CoreError('Üst kategori bulunamadı.');
  }
  const id = newId();
  await db.insert(productCats).values({ id, companyId, code: input.code, name: input.name, parentCategoryId: input.parentCategoryId });
  return id;
}

export async function listProductCats(companyId: string) {
  return db.select().from(productCats).where(and(eq(productCats.companyId, companyId), eq(productCats.active, true)));
}

export async function createBrand(companyId: string, name: string): Promise<string> {
  const id = newId();
  await db.insert(brands).values({ id, companyId, name });
  return id;
}

export async function listBrands(companyId: string) {
  return db.select().from(brands).where(and(eq(brands.companyId, companyId), eq(brands.active, true)));
}

// --- Ürün Master (madde 22-31, 189-190'daki "tek kaynak" ilkesi). ---

export interface CreateProductInput {
  sku: string;
  name: string;
  shortName?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
  productType?: 'STOCK_ITEM' | 'SERVICE' | 'ASSET' | 'KIT' | 'NON_STOCK' | 'CONSUMABLE' | 'SPARE_PART';
  baseUnitId: string;
  purchaseUnitId?: string;
  salesUnitId?: string;
  trackingType?: 'NONE' | 'SERIAL' | 'LOT';
  parentProductId?: string;
  taxRatePercent?: number | string;
}

export async function createProduct(companyId: string, createdByUserId: string, input: CreateProductInput): Promise<string> {
  const [baseUnit] = await db.select({ id: units.id }).from(units).where(and(eq(units.id, input.baseUnitId), eq(units.companyId, companyId))).limit(1);
  if (!baseUnit) throw new CoreError('Taban birim bulunamadı.');

  const id = newId();
  await db.insert(products).values({
    id,
    companyId,
    sku: input.sku,
    name: input.name,
    shortName: input.shortName ?? '',
    description: input.description,
    brandId: input.brandId,
    categoryId: input.categoryId,
    productType: input.productType ?? 'STOCK_ITEM',
    baseUnitId: input.baseUnitId,
    purchaseUnitId: input.purchaseUnitId,
    salesUnitId: input.salesUnitId,
    trackingType: input.trackingType ?? 'NONE',
    parentProductId: input.parentProductId,
    taxRatePercent: input.taxRatePercent === undefined ? undefined : toDb(input.taxRatePercent),
    createdByUserId
  });
  return id;
}

export interface ListProductsFilter {
  search?: string;
  categoryId?: string;
  productType?: string;
}

export async function listProducts(companyId: string, filter?: ListProductsFilter) {
  const conditions = [eq(products.companyId, companyId), eq(products.active, true)];
  if (filter?.categoryId) conditions.push(eq(products.categoryId, filter.categoryId));
  if (filter?.productType) conditions.push(eq(products.productType, filter.productType as NonNullable<(typeof products.$inferInsert)['productType']>));
  if (filter?.search) {
    const term = `%${filter.search}%`;
    conditions.push(or(like(products.sku, term), like(products.name, term))!);
  }

  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      productType: products.productType,
      trackingType: products.trackingType,
      brandName: brands.name,
      categoryName: productCats.name,
      baseUnitCode: units.code
    })
    .from(products)
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(productCats, eq(productCats.id, products.categoryId))
    .innerJoin(units, eq(units.id, products.baseUnitId))
    .where(and(...conditions));
}

export async function getProduct(companyId: string, productId: string) {
  const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.companyId, companyId))).limit(1);
  if (!product) throw new CoreError('Ürün bulunamadı.');

  const [barcodes, suppliers] = await Promise.all([
    db.select().from(productBarcodes).where(eq(productBarcodes.productId, productId)),
    db
      .select({
        id: productSuppliers.id,
        supplierPartyId: productSuppliers.supplierPartyId,
        supplierName: parties.legalName,
        supplierSku: productSuppliers.supplierSku,
        purchasePrice: productSuppliers.purchasePrice,
        currencyCode: productSuppliers.currencyCode,
        leadTimeDays: productSuppliers.leadTimeDays,
        minOrderQty: productSuppliers.minOrderQty
      })
      .from(productSuppliers)
      .innerJoin(parties, eq(parties.id, productSuppliers.supplierPartyId))
      .where(eq(productSuppliers.productId, productId))
  ]);

  return { product, barcodes, suppliers };
}

export async function addProductBarcode(companyId: string, productId: string, barcode: string, barcodeType: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CUSTOM' = 'EAN13'): Promise<string> {
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.companyId, companyId))).limit(1);
  if (!product) throw new CoreError('Ürün bulunamadı.');

  const id = newId();
  await db.insert(productBarcodes).values({ id, companyId, productId, barcode, barcodeType });
  return id;
}

// Barkod okutma akışı (madde 114) — tarama sonucu doğrudan ürünü bulur.
export async function findProductByBarcode(companyId: string, barcode: string) {
  const [row] = await db
    .select({ productId: productBarcodes.productId })
    .from(productBarcodes)
    .where(and(eq(productBarcodes.companyId, companyId), eq(productBarcodes.barcode, barcode)))
    .limit(1);
  if (!row) return null;
  return getProduct(companyId, row.productId);
}

export interface AddProductSupplierInput {
  supplierPartyId: string;
  supplierSku?: string;
  purchasePrice?: number | string;
  currencyCode?: string;
  leadTimeDays?: number;
  minOrderQty?: number | string;
}

// madde 29 — bir ürünün birden fazla tedarikçisi olabilir.
export async function addProductSupplier(companyId: string, productId: string, input: AddProductSupplierInput): Promise<string> {
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.companyId, companyId))).limit(1);
  if (!product) throw new CoreError('Ürün bulunamadı.');
  const [supplier] = await db.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.supplierPartyId), eq(parties.companyId, companyId))).limit(1);
  if (!supplier) throw new CoreError('Tedarikçi cari kartı bulunamadı.');

  const id = newId();
  await db.insert(productSuppliers).values({
    id,
    productId,
    supplierPartyId: input.supplierPartyId,
    supplierSku: input.supplierSku ?? '',
    purchasePrice: input.purchasePrice === undefined ? undefined : toDb(input.purchasePrice),
    currencyCode: input.currencyCode,
    leadTimeDays: input.leadTimeDays,
    minOrderQty: input.minOrderQty === undefined ? undefined : toDb(input.minOrderQty)
  });
  return id;
}
