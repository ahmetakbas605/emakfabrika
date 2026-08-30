'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createBonusRequest, submitBonusRequest, cancelBonusRequest } from '@/lib/hr/bonus';
import { HrError } from '@/lib/hr/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof HrError ? err.message : fallback;
}

// Leave/Overtime'ın aksine (çalışanın KENDİ talebi) bir ödül HR/yönetici
// tarafından bir çalışan İÇİN önerilir — bu yüzden requireSession değil
// requireDepartmentAccess (HR) ile korunuyor.
const CreateBonusSchema = z.object({
  bonusType: z.enum(['PERFORMANCE', 'HOLIDAY', 'REFERRAL', 'RETENTION', 'OTHER']),
  amount: z.string().trim().min(1, 'Tutar gerekli.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  reason: z.string().trim().optional()
});

export async function createBonusRequestAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateBonusSchema.safeParse({
    bonusType: formData.get('bonusType'), amount: formData.get('amount'), currencyCode: formData.get('currencyCode'), reason: formData.get('reason') || undefined
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createBonusRequest(session.companyId, employeeId, session.id, { ...parsed.data, amount: Number(parsed.data.amount) });
  } catch (err) {
    return { error: toErrorMessage(err, 'Ödül talebi oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Ödül talebi taslak olarak kaydedildi — göndermek için "Gönder"e tıklayın.' };
}

const SubmitBonusSchema = z.object({ bonusRequestId: z.string().trim().min(1) });

export async function submitBonusRequestAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = SubmitBonusSchema.safeParse({ bonusRequestId: formData.get('bonusRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitBonusRequest(session.companyId, parsed.data.bonusRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Ödül talebi onaya gönderildi.' };
}

const CancelBonusSchema = z.object({ bonusRequestId: z.string().trim().min(1) });

export async function cancelBonusRequestAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CancelBonusSchema.safeParse({ bonusRequestId: formData.get('bonusRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelBonusRequest(session.companyId, parsed.data.bonusRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Ödül talebi iptal edildi.' };
}
