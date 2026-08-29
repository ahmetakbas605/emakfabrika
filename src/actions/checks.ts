'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createCheck, transitionCheck } from '@/lib/checks';
import { AccountingError } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateCheckSchema = z.object({
  direction: z.enum(['RECEIVED', 'ISSUED']),
  checkNo: z.string().trim().min(1, 'Çek numarası gerekli.'),
  bankName: z.string().trim().optional(),
  partyName: z.string().trim().min(1, 'Keşideci/lehtar adı gerekli.'),
  amount: z.coerce.number().positive('Tutar sıfırdan büyük olmalı.'),
  dueDate: z.string().trim().min(1, 'Vade tarihi gerekli.'),
  accountingAccountId: z.string().trim().min(1, 'Hesap seçilmeli.'),
  counterAccountCode: z.string().trim().optional()
});

export async function createCheckAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateCheckSchema.safeParse({
    direction: formData.get('direction'),
    checkNo: formData.get('checkNo'),
    bankName: optionalField(formData, 'bankName'),
    partyName: formData.get('partyName'),
    amount: formData.get('amount'),
    dueDate: formData.get('dueDate'),
    accountingAccountId: formData.get('accountingAccountId'),
    counterAccountCode: optionalField(formData, 'counterAccountCode')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCheck(session.companyId, { ...parsed.data, createdByUserId: session.id });
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Çek kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/checks`);
  return { success: 'Çek kaydedildi.' };
}

const TransitionSchema = z.object({
  checkId: z.string().trim().min(1),
  toStatus: z.string().trim().min(1),
  counterAccountCode: z.string().trim().min(1, 'Karşı hesap seçilmeli.'),
  note: z.string().trim().optional()
});

export async function transitionCheckAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = TransitionSchema.safeParse({
    checkId: formData.get('checkId'),
    toStatus: formData.get('toStatus'),
    counterAccountCode: formData.get('counterAccountCode'),
    note: optionalField(formData, 'note')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await transitionCheck(session.companyId, { ...parsed.data, createdByUserId: session.id });
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Durum güncellenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/checks`);
  return { success: 'Çek durumu güncellendi.' };
}
