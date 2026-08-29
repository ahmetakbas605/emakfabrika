'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createCashAccount, recordCashTransaction } from '@/lib/cash';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CashAccountSchema = z.object({
  name: z.string().trim().min(1, 'Kasa adı gerekli.'),
  accountingAccountId: z.string().trim().min(1, 'Hesap seçilmeli.')
});

export async function createCashAccountAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CashAccountSchema.safeParse({ name: formData.get('name'), accountingAccountId: formData.get('accountingAccountId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createCashAccount(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/kasa`);
  return { success: 'Kasa oluşturuldu.' };
}

const CashTransactionSchema = z.object({
  cashAccountId: z.string().trim().min(1),
  transactionType: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().positive('Tutar sıfırdan büyük olmalı.'),
  counterAccountCode: z.string().trim().min(1, 'Karşı hesap seçilmeli.'),
  description: z.string().trim().optional(),
  transactionDate: z.string().trim().min(1, 'Tarih gerekli.')
});

export async function recordCashTransactionAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = CashTransactionSchema.safeParse({
    cashAccountId: formData.get('cashAccountId'),
    transactionType: formData.get('transactionType'),
    amount: formData.get('amount'),
    counterAccountCode: formData.get('counterAccountCode'),
    description: optionalField(formData, 'description'),
    transactionDate: formData.get('transactionDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordCashTransaction({ ...parsed.data, companyId: session.companyId, createdByUserId: session.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Kasa hareketi kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/kasa`);
  return { success: 'Kasa hareketi kaydedildi.' };
}
