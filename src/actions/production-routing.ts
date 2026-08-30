'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createRouting } from '@/lib/production/routing';
import { ProductionError } from '@/lib/production/errors';

export type FormState = { error?: string; success?: string } | undefined;

const RoutingOperationSchema = z.object({
  workCenterId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  setupTimeMinutes: z.number().nonnegative().optional(),
  runTimeMinutesPerUnit: z.number().nonnegative().optional(),
  description: z.string().trim().optional()
});

const CreateRoutingSchema = z.object({
  productId: z.string().trim().min(1, 'Ürün gerekli.'),
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  operations: z.array(RoutingOperationSchema).min(1, 'En az bir operasyon gerekli.')
});

export async function createRoutingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let opsRaw: unknown;
  try {
    opsRaw = JSON.parse(String(formData.get('operationsJson') || '[]'));
  } catch {
    return { error: 'Geçersiz operasyon verisi.' };
  }
  const parsed = CreateRoutingSchema.safeParse({ productId: formData.get('productId'), code: formData.get('code'), name: formData.get('name'), operations: opsRaw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createRouting(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: err instanceof ProductionError ? err.message : 'Routing oluşturulamadı.' };
  }
  revalidatePath('/dashboard/production/routing');
  return { success: 'Routing oluşturuldu.' };
}
