'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createFixedAsset, runDepreciation } from '@/lib/fixed-assets';
import { AccountingError } from '@/lib/accounting';

export type FormState = { error?: string; success?: string } | undefined;

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli.'),
  accountingAccountId: z.string().trim().min(1, 'Demirbaş hesabı seçilmeli.'),
  accumDeprAccountId: z.string().trim().min(1, 'Birikmiş amortisman hesabı seçilmeli.'),
  deprExpAccountId: z.string().trim().min(1, 'Amortisman gideri hesabı seçilmeli.'),
  purchaseDate: z.string().trim().min(1, 'Alış tarihi gerekli.'),
  purchaseCost: z.coerce.number().positive('Tutar sıfırdan büyük olmalı.'),
  usefulLifeYears: z.coerce.number().int().positive('Faydalı ömür pozitif bir tam sayı olmalı.')
});

export async function createFixedAssetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateSchema.safeParse({
    name: formData.get('name'),
    accountingAccountId: formData.get('accountingAccountId'),
    accumDeprAccountId: formData.get('accumDeprAccountId'),
    deprExpAccountId: formData.get('deprExpAccountId'),
    purchaseDate: formData.get('purchaseDate'),
    purchaseCost: formData.get('purchaseCost'),
    usefulLifeYears: formData.get('usefulLifeYears')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createFixedAsset(session.companyId, parsed.data, session.id);
  revalidatePath(`/dashboard/departments/${departmentId}/fixed-assets`);
  return { success: 'Demirbaş oluşturuldu.' };
}

const DepreciationSchema = z.object({
  fixedAssetId: z.string().trim().min(1),
  periodDate: z.string().trim().min(1, 'Dönem tarihi gerekli.')
});

export async function runDepreciationAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = DepreciationSchema.safeParse({ fixedAssetId: formData.get('fixedAssetId'), periodDate: formData.get('periodDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await runDepreciation(session.companyId, parsed.data.fixedAssetId, parsed.data.periodDate, session.id);
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Amortisman işlenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/fixed-assets`);
  return { success: 'Amortisman işlendi.' };
}
