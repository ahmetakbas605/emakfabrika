'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createCashFlowItem, markCashFlowItemRealized, cancelCashFlowItem } from '@/lib/treasury/cashflow';
import { TreasuryError } from '@/lib/treasury/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof TreasuryError ? err.message : fallback;
}

const CreateCashFlowItemSchema = z.object({
  direction: z.enum(['INFLOW', 'OUTFLOW']),
  description: z.string().trim().min(1, 'Açıklama gerekli.'),
  amount: z.coerce.number().positive('Tutar pozitif olmalı.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  expectedDate: z.string().trim().min(1, 'Beklenen tarih gerekli.')
});

export async function createCashFlowItemAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateCashFlowItemSchema.safeParse({
    direction: formData.get('direction'), description: formData.get('description'), amount: formData.get('amount'),
    currencyCode: formData.get('currencyCode'), expectedDate: formData.get('expectedDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCashFlowItem(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Nakit akış kalemi oluşturulamadı.') };
  }
  revalidatePath('/dashboard/treasury');
  return { success: 'Nakit akış kalemi oluşturuldu.' };
}

const ItemIdSchema = z.object({ itemId: z.string().trim().min(1) });

export async function markCashFlowItemRealizedAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ItemIdSchema.safeParse({ itemId: formData.get('itemId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await markCashFlowItemRealized(session.companyId, parsed.data.itemId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gerçekleşti olarak işaretlenemedi.') };
  }
  revalidatePath('/dashboard/treasury');
  return { success: 'Gerçekleşti olarak işaretlendi.' };
}

export async function cancelCashFlowItemAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ItemIdSchema.safeParse({ itemId: formData.get('itemId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelCashFlowItem(session.companyId, parsed.data.itemId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Kalem iptal edilemedi.') };
  }
  revalidatePath('/dashboard/treasury');
  return { success: 'Kalem iptal edildi.' };
}
