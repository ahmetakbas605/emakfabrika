'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createAsset, assignAsset } from '@/lib/it/assets';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateAssetSchema = z.object({
  assetTag: z.string().trim().min(1, 'Varlık etiketi gerekli.'),
  assetTypeCode: z.string().trim().min(1, 'Tür seçilmeli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  manufacturer: z.string().trim().optional(),
  model: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  purchaseDate: z.string().trim().optional(),
  purchaseCost: z.string().trim().optional()
});

export async function createAssetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'manage_assets');
  const parsed = CreateAssetSchema.safeParse({
    assetTag: formData.get('assetTag'),
    assetTypeCode: formData.get('assetTypeCode'),
    name: formData.get('name'),
    manufacturer: optionalField(formData, 'manufacturer'),
    model: optionalField(formData, 'model'),
    serialNumber: optionalField(formData, 'serialNumber'),
    purchaseDate: optionalField(formData, 'purchaseDate'),
    purchaseCost: optionalField(formData, 'purchaseCost')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createAsset(
      session.companyId,
      { ...parsed.data, purchaseCost: parsed.data.purchaseCost ? Number(parsed.data.purchaseCost) : undefined },
      session.id
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Varlık oluşturulamadı — bu etiket zaten kayıtlı olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/assets`);
  return { success: 'Varlık oluşturuldu.' };
}

const AssignSchema = z.object({
  assetId: z.string().trim().min(1),
  userId: z.string().trim().min(1, 'Kullanıcı seçilmeli.'),
  reason: z.string().trim().optional()
});

export async function assignAssetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = AssignSchema.safeParse({ assetId: formData.get('assetId'), userId: formData.get('userId'), reason: optionalField(formData, 'reason') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await assignAsset(session.companyId, parsed.data, session.id);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Atama yapılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/assets`);
  return { success: 'Varlık atandı.' };
}
