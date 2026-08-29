'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireFactoryAdmin } from '@/lib/dal';
import { createParty, addPartyAddress, addPartyContact, createPaymentTerm } from '@/lib/master-data/parties';
import { createProduct, createProductCat, createBrand, addProductBarcode, addProductSupplier } from '@/lib/master-data/products';
import { createUnit } from '@/lib/master-data/units';
import { recordExchangeRate } from '@/lib/master-data/currency';
import { createPriceList, setPriceListItem } from '@/lib/master-data/price-lists';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

// Faz 1 (ERP Genişletme) — tüm Master Data eylemleri requireFactoryAdmin ile
// korunuyor (departman-scoped DEĞİL, requireDepartmentAccess kullanılmıyor —
// bu veri hiçbir departmana ait değil, şirketin TÜMÜNE ait). Faz 2B/2C'de
// Satınalma/Satış rolleri gerçek ihtiyaç doğurduğunda daha ince taneli bir
// izin modeline açılabilir; bugün tek düğüm (fabrika yöneticisi) yeterli.

const PartySchema = z.object({
  partyType: z.enum(['PERSON', 'COMPANY']).optional(),
  code: z.string().trim().optional(),
  legalName: z.string().trim().min(1, 'Unvan gerekli.'),
  tradeName: z.string().trim().optional(),
  taxNumber: z.string().trim().optional(),
  taxOffice: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  paymentTermId: z.string().trim().optional(),
  roleCustomer: z.string().trim().optional(),
  roleSupplier: z.string().trim().optional()
});

export async function createPartyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PartySchema.safeParse({
    partyType: optionalField(formData, 'partyType'),
    code: optionalField(formData, 'code'),
    legalName: formData.get('legalName'),
    tradeName: optionalField(formData, 'tradeName'),
    taxNumber: optionalField(formData, 'taxNumber'),
    taxOffice: optionalField(formData, 'taxOffice'),
    email: optionalField(formData, 'email'),
    phone: optionalField(formData, 'phone'),
    currencyCode: optionalField(formData, 'currencyCode'),
    paymentTermId: optionalField(formData, 'paymentTermId'),
    roleCustomer: optionalField(formData, 'roleCustomer'),
    roleSupplier: optionalField(formData, 'roleSupplier')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const roles: ('CUSTOMER' | 'SUPPLIER')[] = [];
  if (parsed.data.roleCustomer === 'on') roles.push('CUSTOMER');
  if (parsed.data.roleSupplier === 'on') roles.push('SUPPLIER');

  try {
    await createParty(session.companyId, session.id, { ...parsed.data, roles });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Cari kartı oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/parties');
  return { success: 'Cari kartı oluşturuldu.' };
}

const PartyAddressSchema = z.object({
  partyId: z.string().trim().min(1),
  addressType: z.enum(['BILLING', 'SHIPPING', 'OTHER']).optional(),
  label: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  district: z.string().trim().optional()
});

export async function addPartyAddressAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PartyAddressSchema.safeParse({
    partyId: formData.get('partyId'),
    addressType: optionalField(formData, 'addressType'),
    label: optionalField(formData, 'label'),
    addressLine: optionalField(formData, 'addressLine'),
    city: optionalField(formData, 'city'),
    district: optionalField(formData, 'district')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addPartyAddress(session.companyId, parsed.data.partyId, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Adres eklenemedi.' };
  }
  revalidatePath(`/dashboard/master-data/parties/${parsed.data.partyId}`);
  return { success: 'Adres eklendi.' };
}

const PartyContactSchema = z.object({
  partyId: z.string().trim().min(1),
  fullName: z.string().trim().min(1, 'Ad gerekli.'),
  title: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional()
});

export async function addPartyContactAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PartyContactSchema.safeParse({
    partyId: formData.get('partyId'),
    fullName: formData.get('fullName'),
    title: optionalField(formData, 'title'),
    email: optionalField(formData, 'email'),
    phone: optionalField(formData, 'phone')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addPartyContact(session.companyId, parsed.data.partyId, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Yetkili eklenemedi.' };
  }
  revalidatePath(`/dashboard/master-data/parties/${parsed.data.partyId}`);
  return { success: 'Yetkili eklendi.' };
}

const PaymentTermSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), netDays: z.string().trim().min(1, 'Vade gerekli.') });

export async function createPaymentTermAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PaymentTermSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), netDays: formData.get('netDays') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createPaymentTerm(session.companyId, parsed.data.code, parsed.data.name, Number(parsed.data.netDays));
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Ödeme vadesi oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/payment-terms');
  return { success: 'Ödeme vadesi oluşturuldu.' };
}

const UnitSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), baseUnitId: z.string().trim().optional(), conversionFactor: z.string().trim().optional() });

export async function createUnitAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = UnitSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), baseUnitId: optionalField(formData, 'baseUnitId'), conversionFactor: optionalField(formData, 'conversionFactor') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createUnit(session.companyId, { code: parsed.data.code, name: parsed.data.name, baseUnitId: parsed.data.baseUnitId, conversionFactor: parsed.data.conversionFactor });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Birim oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/units');
  return { success: 'Birim oluşturuldu.' };
}

const ExchangeRateSchema = z.object({ currencyCode: z.string().trim().min(1), rateDate: z.string().trim().min(1, 'Tarih gerekli.'), rate: z.string().trim().min(1, 'Kur gerekli.'), rateType: z.enum(['BUY', 'SELL', 'EFFECTIVE', 'CENTRAL_BANK', 'CUSTOM']).optional() });

export async function recordExchangeRateAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireFactoryAdmin();
  const parsed = ExchangeRateSchema.safeParse({ currencyCode: formData.get('currencyCode'), rateDate: formData.get('rateDate'), rate: formData.get('rate'), rateType: optionalField(formData, 'rateType') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordExchangeRate(parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Kur kaydedilemedi.' };
  }
  revalidatePath('/dashboard/master-data/currencies');
  return { success: 'Kur kaydedildi.' };
}

const ProductCatSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), parentCategoryId: z.string().trim().optional() });

export async function createProductCatAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ProductCatSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), parentCategoryId: optionalField(formData, 'parentCategoryId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProductCat(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Kategori oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/products');
  return { success: 'Kategori oluşturuldu.' };
}

const BrandSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.') });

export async function createBrandAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = BrandSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createBrand(session.companyId, parsed.data.name);
  revalidatePath('/dashboard/master-data/products');
  return { success: 'Marka oluşturuldu.' };
}

const ProductSchema = z.object({
  sku: z.string().trim().min(1, 'SKU gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  shortName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  productType: z.enum(['STOCK_ITEM', 'SERVICE', 'ASSET', 'KIT', 'NON_STOCK', 'CONSUMABLE', 'SPARE_PART']).optional(),
  baseUnitId: z.string().trim().min(1, 'Taban birim gerekli.'),
  trackingType: z.enum(['NONE', 'SERIAL', 'LOT']).optional(),
  taxRatePercent: z.string().trim().optional()
});

export async function createProductAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ProductSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    shortName: optionalField(formData, 'shortName'),
    description: optionalField(formData, 'description'),
    brandId: optionalField(formData, 'brandId'),
    categoryId: optionalField(formData, 'categoryId'),
    productType: optionalField(formData, 'productType'),
    baseUnitId: formData.get('baseUnitId'),
    trackingType: optionalField(formData, 'trackingType'),
    taxRatePercent: optionalField(formData, 'taxRatePercent')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProduct(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Ürün oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/products');
  return { success: 'Ürün oluşturuldu.' };
}

const ProductBarcodeSchema = z.object({ productId: z.string().trim().min(1), barcode: z.string().trim().min(1, 'Barkod gerekli.'), barcodeType: z.enum(['EAN13', 'EAN8', 'UPC', 'CODE128', 'CUSTOM']).optional() });

export async function addProductBarcodeAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ProductBarcodeSchema.safeParse({ productId: formData.get('productId'), barcode: formData.get('barcode'), barcodeType: optionalField(formData, 'barcodeType') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addProductBarcode(session.companyId, parsed.data.productId, parsed.data.barcode, parsed.data.barcodeType);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Barkod eklenemedi.' };
  }
  revalidatePath(`/dashboard/master-data/products/${parsed.data.productId}`);
  return { success: 'Barkod eklendi.' };
}

const ProductSupplierSchema = z.object({
  productId: z.string().trim().min(1),
  supplierPartyId: z.string().trim().min(1, 'Tedarikçi seçilmeli.'),
  supplierSku: z.string().trim().optional(),
  purchasePrice: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  leadTimeDays: z.string().trim().optional(),
  minOrderQty: z.string().trim().optional()
});

export async function addProductSupplierAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ProductSupplierSchema.safeParse({
    productId: formData.get('productId'),
    supplierPartyId: formData.get('supplierPartyId'),
    supplierSku: optionalField(formData, 'supplierSku'),
    purchasePrice: optionalField(formData, 'purchasePrice'),
    currencyCode: optionalField(formData, 'currencyCode'),
    leadTimeDays: optionalField(formData, 'leadTimeDays'),
    minOrderQty: optionalField(formData, 'minOrderQty')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addProductSupplier(session.companyId, parsed.data.productId, {
      supplierPartyId: parsed.data.supplierPartyId,
      supplierSku: parsed.data.supplierSku,
      purchasePrice: parsed.data.purchasePrice,
      currencyCode: parsed.data.currencyCode,
      leadTimeDays: parsed.data.leadTimeDays ? Number(parsed.data.leadTimeDays) : undefined,
      minOrderQty: parsed.data.minOrderQty
    });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Tedarikçi eklenemedi.' };
  }
  revalidatePath(`/dashboard/master-data/products/${parsed.data.productId}`);
  return { success: 'Tedarikçi eklendi.' };
}

const PriceListSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.'), currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'), validFrom: z.string().trim().optional(), validTo: z.string().trim().optional(), partyId: z.string().trim().optional() });

export async function createPriceListAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PriceListSchema.safeParse({ name: formData.get('name'), currencyCode: formData.get('currencyCode'), validFrom: optionalField(formData, 'validFrom'), validTo: optionalField(formData, 'validTo'), partyId: optionalField(formData, 'partyId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createPriceList(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Fiyat listesi oluşturulamadı.' };
  }
  revalidatePath('/dashboard/master-data/price-lists');
  return { success: 'Fiyat listesi oluşturuldu.' };
}

const PriceListItemSchema = z.object({ priceListId: z.string().trim().min(1), productId: z.string().trim().min(1, 'Ürün seçilmeli.'), price: z.string().trim().min(1, 'Fiyat gerekli.'), discountPercent: z.string().trim().optional() });

export async function setPriceListItemAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PriceListItemSchema.safeParse({ priceListId: formData.get('priceListId'), productId: formData.get('productId'), price: formData.get('price'), discountPercent: optionalField(formData, 'discountPercent') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setPriceListItem(session.companyId, parsed.data.priceListId, { productId: parsed.data.productId, price: parsed.data.price, discountPercent: parsed.data.discountPercent });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Fiyat eklenemedi.' };
  }
  revalidatePath(`/dashboard/master-data/price-lists/${parsed.data.priceListId}`);
  return { success: 'Fiyat eklendi/güncellendi.' };
}
