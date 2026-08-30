'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createCollection } from '@/lib/sales/collections';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateCollectionSchema = z.object({
  invoiceId: z.string().trim().min(1),
  collectionDate: z.string().trim().min(1, 'Tarih gerekli.'),
  amount: z.string().trim().min(1, 'Tutar gerekli.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  method: z.enum(['CASH', 'BANK', 'CHECK', 'OTHER']),
  cashOrBankAccountCode: z.string().trim().optional(),
  receivableAccountCode: z.string().trim().optional()
});

export async function createCollectionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateCollectionSchema.safeParse({
    invoiceId: formData.get('invoiceId'), collectionDate: formData.get('collectionDate'), amount: formData.get('amount'), currencyCode: formData.get('currencyCode'),
    method: formData.get('method'), cashOrBankAccountCode: optionalField(formData, 'cashOrBankAccountCode'), receivableAccountCode: optionalField(formData, 'receivableAccountCode')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCollection(session.companyId, session.id, { ...parsed.data, amount: Number(parsed.data.amount) });
  } catch (err) {
    return { error: err instanceof SalesError ? err.message : 'Tahsilat kaydedilemedi.' };
  }
  revalidatePath('/dashboard/sales/invoices');
  return { success: 'Tahsilat kaydedildi.' };
}
