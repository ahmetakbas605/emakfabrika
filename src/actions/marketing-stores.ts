'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { closeShift, createStore, openShift, recordStoreSale } from '@/lib/marketing/stores';
import { MarketingError } from '@/lib/marketing/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateStoreSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  storeType: z.enum(['POS', 'ORDER_INTAKE']),
  location: z.string().trim().optional(),
  accountingAccountId: z.string().trim().optional(),
  salesRevenueAccountCode: z.string().trim().optional()
});

export async function createStoreAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateStoreSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    storeType: formData.get('storeType'),
    location: optionalField(formData, 'location'),
    accountingAccountId: optionalField(formData, 'accountingAccountId'),
    salesRevenueAccountCode: optionalField(formData, 'salesRevenueAccountCode')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createStore(session.companyId, { departmentId, ...parsed.data });
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Mağaza oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/stores`);
  return { success: 'Mağaza tanımlandı.' };
}

export async function openShiftAction(
  departmentId: string,
  storeId: string,
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  try {
    await openShift(session.companyId, session.id, storeId);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Vardiya açılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/stores`);
  return { success: 'Vardiya açıldı.' };
}

const SaleSchema = z.object({
  storeId: z.string().trim().min(1, 'Mağaza gerekli.'),
  partyId: z.string().trim().optional(),
  productId: z.string().trim().min(1, 'Ürün seçin.'),
  quantity: z.string().trim().min(1, 'Miktar gerekli.'),
  unitPrice: z.string().trim().min(1, 'Birim fiyat gerekli.')
});

// Kullanıcının açık isteği ("kantar/mağaza yetki tanımı") ile AYNI
// disiplin: satış kaydı 'create', vardiya açma da 'create' — kasiyer
// rolünde (STORE_CASHIER) migrate.ts'te bu izin zaten var.
export async function recordStoreSaleAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = SaleSchema.safeParse({
    storeId: formData.get('storeId'),
    partyId: optionalField(formData, 'partyId'),
    productId: formData.get('productId'),
    quantity: formData.get('quantity'),
    unitPrice: formData.get('unitPrice')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordStoreSale(session.companyId, session.id, {
      storeId: parsed.data.storeId,
      partyId: parsed.data.partyId,
      lines: [{ productId: parsed.data.productId, quantity: parsed.data.quantity, unitPrice: parsed.data.unitPrice }]
    });
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Satış kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/stores`);
  return { success: 'Satış kaydedildi.' };
}

// Gün sonu — 'post' yetkisi ister (muhasebeleştir, kasa hesabına giden
// tek TOPLU kayıt). STORE_CASHIER'da bu izin var (migrate.ts) ama
// SALES_USER'da YOK — kasiyer kendi gün sonunu kapatabilir, satış
// personeli kapatamaz.
export async function closeShiftAction(
  departmentId: string,
  shiftId: string,
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  try {
    await closeShift(session.companyId, session.id, shiftId);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Gün sonu kapatılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/stores`);
  return { success: 'Gün sonu muhasebeye aktarıldı.' };
}
