'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  createVendor, createSoftwareProduct, createInstallation, createLicense, assignLicenseSeat,
  createWarranty, createContract
} from '@/lib/it/licensing';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const VendorSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.'), contactName: z.string().trim().optional(), contactEmail: z.string().trim().optional(), contactPhone: z.string().trim().optional() });

export async function createVendorAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = VendorSchema.safeParse({ name: formData.get('name'), contactName: optionalField(formData, 'contactName'), contactEmail: optionalField(formData, 'contactEmail'), contactPhone: optionalField(formData, 'contactPhone') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createVendor(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Tedarikçi eklendi.' };
}

const ProductSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.'), publisher: z.string().trim().optional(), vendorId: z.string().trim().optional() });

export async function createSoftwareProductAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = ProductSchema.safeParse({ name: formData.get('name'), publisher: optionalField(formData, 'publisher'), vendorId: optionalField(formData, 'vendorId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createSoftwareProduct(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Yazılım ürünü eklendi.' };
}

const InstallationSchema = z.object({ productId: z.string().trim().min(1, 'Ürün seçilmeli.'), assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), installedVersion: z.string().trim().optional() });

export async function createInstallationAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = InstallationSchema.safeParse({ productId: formData.get('productId'), assetId: formData.get('assetId'), installedVersion: optionalField(formData, 'installedVersion') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createInstallation(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Kurulum kaydedildi.' };
}

const LicenseSchema = z.object({
  productId: z.string().trim().min(1, 'Ürün seçilmeli.'), vendorId: z.string().trim().optional(), licenseKey: z.string().trim().optional(),
  seats: z.string().trim().optional(), purchaseDate: z.string().trim().optional(), expiresAt: z.string().trim().optional(), cost: z.string().trim().optional()
});

export async function createLicenseAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = LicenseSchema.safeParse({
    productId: formData.get('productId'), vendorId: optionalField(formData, 'vendorId'), licenseKey: optionalField(formData, 'licenseKey'),
    seats: optionalField(formData, 'seats'), purchaseDate: optionalField(formData, 'purchaseDate'), expiresAt: optionalField(formData, 'expiresAt'), cost: optionalField(formData, 'cost')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createLicense(session.companyId, { ...parsed.data, seats: parsed.data.seats ? Number(parsed.data.seats) : undefined, cost: parsed.data.cost });
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Lisans eklendi.' };
}

const AssignSeatSchema = z.object({ licenseId: z.string().trim().min(1, 'Lisans seçilmeli.'), installationId: z.string().trim().min(1, 'Kurulum seçilmeli.') });

export async function assignLicenseSeatAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = AssignSeatSchema.safeParse({ licenseId: formData.get('licenseId'), installationId: formData.get('installationId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await assignLicenseSeat(session.companyId, parsed.data.licenseId, parsed.data.installationId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Koltuk atanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Koltuk atandı.' };
}

const WarrantySchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), vendorId: z.string().trim().optional(), startDate: z.string().trim().min(1), endDate: z.string().trim().min(1), terms: z.string().trim().optional(), cost: z.string().trim().optional() });

export async function createWarrantyAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = WarrantySchema.safeParse({
    assetId: formData.get('assetId'), vendorId: optionalField(formData, 'vendorId'), startDate: formData.get('startDate'),
    endDate: formData.get('endDate'), terms: optionalField(formData, 'terms'), cost: optionalField(formData, 'cost')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createWarranty(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Garanti kaydı eklendi.' };
}

const ContractSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'), contractType: z.enum(['SUPPORT', 'MAINTENANCE', 'SERVICE', 'LEASE', 'OTHER']),
  vendorId: z.string().trim().optional(), startDate: z.string().trim().min(1), endDate: z.string().trim().min(1), cost: z.string().trim().optional(),
  assetIds: z.array(z.string().trim()).optional()
});

export async function createContractAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = ContractSchema.safeParse({
    title: formData.get('title'), contractType: formData.get('contractType'), vendorId: optionalField(formData, 'vendorId'),
    startDate: formData.get('startDate'), endDate: formData.get('endDate'), cost: optionalField(formData, 'cost'),
    assetIds: formData.getAll('assetIds').map(String)
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createContract(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/licensing`);
  return { success: 'Sözleşme eklendi.' };
}
