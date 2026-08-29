'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createBudget, addBudgetItem } from '@/lib/budgets';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const BudgetSchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli.'),
  periodStart: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  periodEnd: z.string().trim().min(1, 'Bitiş tarihi gerekli.')
});

export async function createBudgetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = BudgetSchema.safeParse({ name: formData.get('name'), periodStart: formData.get('periodStart'), periodEnd: formData.get('periodEnd') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createBudget(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/budgets`);
  return { success: 'Bütçe oluşturuldu.' };
}

const ItemSchema = z.object({
  budgetId: z.string().trim().min(1),
  accountId: z.string().trim().min(1, 'Hesap seçilmeli.'),
  month: z.string().trim().optional(),
  plannedAmount: z.coerce.number().positive('Tutar sıfırdan büyük olmalı.')
});

export async function addBudgetItemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'create');
  const parsed = ItemSchema.safeParse({
    budgetId: formData.get('budgetId'),
    accountId: formData.get('accountId'),
    month: optionalField(formData, 'month'),
    plannedAmount: formData.get('plannedAmount')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await addBudgetItem({ ...parsed.data, month: parsed.data.month ? Number(parsed.data.month) : undefined });
  revalidatePath(`/dashboard/departments/${departmentId}/budgets/${parsed.data.budgetId}`);
  return { success: 'Bütçe kalemi eklendi.' };
}
