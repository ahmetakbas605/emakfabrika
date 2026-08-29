'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { setVmHost } from '@/lib/it/servers';
import { ItError } from '@/lib/it/errors';

export type FormState = { error?: string; success?: string } | undefined;

const SetHostSchema = z.object({ vmAssetId: z.string().trim().min(1, 'VM seçilmeli.'), hostAssetId: z.string().trim().min(1, 'Host sunucu seçilmeli.') });

export async function setVmHostAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = SetHostSchema.safeParse({ vmAssetId: formData.get('vmAssetId'), hostAssetId: formData.get('hostAssetId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setVmHost(session.companyId, parsed.data.vmAssetId, parsed.data.hostAssetId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Host atanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/servers`);
  return { success: 'VM host\'a atandı.' };
}
