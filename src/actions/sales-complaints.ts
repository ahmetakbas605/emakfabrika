'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createComplaint, updateComplaintStatus, resolveComplaint } from '@/lib/sales/complaints';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const CreateComplaintSchema = z.object({
  partyId: z.string().trim().min(1, 'Cari gerekli.'),
  orderId: z.string().trim().optional(),
  subject: z.string().trim().min(1, 'Konu gerekli.'),
  description: z.string().trim().min(1, 'Açıklama gerekli.'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
});

export async function createComplaintAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateComplaintSchema.safeParse({
    partyId: formData.get('partyId'), orderId: optionalField(formData, 'orderId'), subject: formData.get('subject'),
    description: formData.get('description'), priority: optionalField(formData, 'priority')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createComplaint(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Şikayet oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/complaints');
  return { success: 'Şikayet kaydedildi.' };
}

const UpdateStatusSchema = z.object({ complaintId: z.string().trim().min(1), status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']) });

export async function updateComplaintStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = UpdateStatusSchema.safeParse({ complaintId: formData.get('complaintId'), status: formData.get('status') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await updateComplaintStatus(session.companyId, parsed.data.complaintId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Durum güncellenemedi.') };
  }
  revalidatePath('/dashboard/sales/complaints');
  return { success: 'Durum güncellendi.' };
}

const ResolveSchema = z.object({ complaintId: z.string().trim().min(1), resolutionNote: z.string().trim().min(1, 'Çözüm notu gerekli.') });

export async function resolveComplaintAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ResolveSchema.safeParse({ complaintId: formData.get('complaintId'), resolutionNote: formData.get('resolutionNote') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await resolveComplaint(session.companyId, parsed.data.complaintId, parsed.data.resolutionNote);
  } catch (err) {
    return { error: toErrorMessage(err, 'Çözümlenemedi.') };
  }
  revalidatePath('/dashboard/sales/complaints');
  return { success: 'Şikayet çözümlendi.' };
}
