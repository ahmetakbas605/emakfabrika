'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createOvertimeRequest, submitOvertimeRequest, cancelOvertimeRequest } from '@/lib/hr/overtime';
import { HrError } from '@/lib/hr/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof HrError ? err.message : fallback;
}

const CreateOvertimeSchema = z.object({
  workDate: z.string().trim().min(1, 'Tarih gerekli.'),
  hours: z.string().trim().min(1, 'Saat gerekli.'),
  reason: z.string().trim().optional()
});

export async function createOvertimeRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.employeeId) return { error: 'ERP hesabınız bir özlük kaydına bağlı değil — İK ile iletişime geçin.' };

  const parsed = CreateOvertimeSchema.safeParse({ workDate: formData.get('workDate'), hours: formData.get('hours'), reason: formData.get('reason') || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createOvertimeRequest(session.companyId, session.employeeId, session.id, { workDate: parsed.data.workDate, hours: Number(parsed.data.hours), reason: parsed.data.reason });
  } catch (err) {
    return { error: toErrorMessage(err, 'Fazla mesai talebi oluşturulamadı.') };
  }
  revalidatePath('/dashboard/hr/overtime');
  return { success: 'Fazla mesai talebi taslak olarak kaydedildi — göndermek için aşağıdaki listeden "Gönder"e tıklayın.' };
}

const SubmitOvertimeSchema = z.object({ overtimeRequestId: z.string().trim().min(1) });

export async function submitOvertimeRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitOvertimeSchema.safeParse({ overtimeRequestId: formData.get('overtimeRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitOvertimeRequest(session.companyId, parsed.data.overtimeRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath('/dashboard/hr/overtime');
  return { success: 'Fazla mesai talebi onaya gönderildi.' };
}

const CancelOvertimeSchema = z.object({ overtimeRequestId: z.string().trim().min(1) });

export async function cancelOvertimeRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CancelOvertimeSchema.safeParse({ overtimeRequestId: formData.get('overtimeRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelOvertimeRequest(session.companyId, parsed.data.overtimeRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/hr/overtime');
  return { success: 'Fazla mesai talebi iptal edildi.' };
}
