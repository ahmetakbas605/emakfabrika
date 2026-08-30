'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createWorkCenter } from '@/lib/production/workcenters';

export type FormState = { error?: string; success?: string } | undefined;

const CreateWorkCenterSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  capacityPerHour: z.string().trim().optional()
});

export async function createWorkCenterAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateWorkCenterSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), capacityPerHour: formData.get('capacityPerHour') || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWorkCenter(session.companyId, { code: parsed.data.code, name: parsed.data.name, capacityPerHour: parsed.data.capacityPerHour ? Number(parsed.data.capacityPerHour) : undefined });
  } catch {
    return { error: 'İş merkezi oluşturulamadı.' };
  }
  revalidatePath('/dashboard/production');
  return { success: 'İş merkezi oluşturuldu.' };
}
