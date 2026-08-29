'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createCostCenter } from '@/lib/cost-centers';

export type FormState = { error?: string; success?: string } | undefined;

const Schema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.')
});

export async function createCostCenterAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = Schema.safeParse({ code: formData.get('code'), name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCostCenter(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Masraf merkezi oluşturulamadı — bu kod zaten kayıtlı olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/cost-centers`);
  return { success: 'Masraf merkezi oluşturuldu.' };
}
