'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { promoteAssetToCI, createRelationship } from '@/lib/it/cmdb';
import { ItError } from '@/lib/it/errors';

export type FormState = { error?: string; success?: string } | undefined;

const PromoteSchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.') });

export async function promoteAssetToCIAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = PromoteSchema.safeParse({ assetId: formData.get('assetId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await promoteAssetToCI(session.companyId, parsed.data.assetId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'CMDB kaydı oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/cmdb`);
  return { success: 'Varlık CMDB kaydına (CI) yükseltildi.' };
}

const RelationshipSchema = z.object({
  sourceCiId: z.string().trim().min(1, 'Kaynak CI seçilmeli.'),
  targetCiId: z.string().trim().min(1, 'Hedef CI seçilmeli.'),
  relationshipType: z.string().trim().min(1, 'İlişki türü seçilmeli.')
});

export async function createRelationshipAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'configure');
  const parsed = RelationshipSchema.safeParse({
    sourceCiId: formData.get('sourceCiId'),
    targetCiId: formData.get('targetCiId'),
    relationshipType: formData.get('relationshipType')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createRelationship(parsed.data);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'İlişki oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/cmdb`);
  return { success: 'İlişki oluşturuldu.' };
}
