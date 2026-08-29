'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createBankAccount, recordBankTransaction } from '@/lib/bank';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const BankAccountSchema = z.object({
  name: z.string().trim().min(1, 'Banka hesabı adı gerekli.'),
  iban: z.string().trim().optional(),
  accountingAccountId: z.string().trim().min(1, 'Hesap seçilmeli.')
});

export async function createBankAccountAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = BankAccountSchema.safeParse({ name: formData.get('name'), iban: optionalField(formData, 'iban'), accountingAccountId: formData.get('accountingAccountId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createBankAccount(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/banka`);
  return { success: 'Banka hesabı oluşturuldu.' };
}

const BankTransactionSchema = z.object({
  bankAccountId: z.string().trim().min(1),
  transactionType: z.enum(['IN', 'OUT']),
  method: z.enum(['HAVALE', 'EFT', 'FAST', 'KREDI_KARTI', 'POS', 'KOMISYON', 'DIGER']),
  amount: z.coerce.number().positive('Tutar sıfırdan büyük olmalı.'),
  counterAccountCode: z.string().trim().min(1, 'Karşı hesap seçilmeli.'),
  description: z.string().trim().optional(),
  transactionDate: z.string().trim().min(1, 'Tarih gerekli.')
});

export async function recordBankTransactionAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = BankTransactionSchema.safeParse({
    bankAccountId: formData.get('bankAccountId'),
    transactionType: formData.get('transactionType'),
    method: formData.get('method'),
    amount: formData.get('amount'),
    counterAccountCode: formData.get('counterAccountCode'),
    description: optionalField(formData, 'description'),
    transactionDate: formData.get('transactionDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordBankTransaction({ ...parsed.data, companyId: session.companyId, createdByUserId: session.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Banka hareketi kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/banka`);
  return { success: 'Banka hareketi kaydedildi.' };
}
