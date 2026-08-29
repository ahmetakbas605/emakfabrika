'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createChange, recordApproval, scheduleChange } from '@/lib/it/changes';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateChangeSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  impactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  scheduledAt: z.string().trim().optional()
});

export async function createChangeAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateChangeSchema.safeParse({
    title: formData.get('title'), description: optionalField(formData, 'description'),
    riskLevel: formData.get('riskLevel'), impactLevel: formData.get('impactLevel'), scheduledAt: optionalField(formData, 'scheduledAt')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createChange(session.companyId, { ...parsed.data, requestedByUserId: session.id });
  revalidatePath(`/dashboard/departments/${departmentId}/it/changes`);
  return { success: 'Değişiklik talebi oluşturuldu.' };
}

const ApprovalSchema = z.object({ changeId: z.string().trim().min(1), decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().optional() });

export async function recordApprovalAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'approve');
  const parsed = ApprovalSchema.safeParse({ changeId: formData.get('changeId'), decision: formData.get('decision'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordApproval(session.companyId, parsed.data.changeId, session.id, parsed.data.decision, parsed.data.note);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Karar kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/changes`);
  return { success: 'Karar kaydedildi.' };
}

const ScheduleSchema = z.object({ changeId: z.string().trim().min(1) });

export async function scheduleChangeAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ScheduleSchema.safeParse({ changeId: formData.get('changeId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await scheduleChange(session.companyId, parsed.data.changeId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Planlanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/changes`);
  return { success: 'Değişiklik planlandı.' };
}
