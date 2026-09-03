'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  archiveOccupationalHealthRecord,
  createOccupationalHealthRecord
} from '@/lib/hr/occupational-health';
import { HrError } from '@/lib/hr/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateSchema = z.object({
  employeeId: z.string().trim().min(1, 'Çalışan seçin.'),
  recordType: z.enum(['EXAMINATION', 'HEALTH_REPORT', 'PERIODIC_FOLLOWUP']),
  examKind: z.enum(['PRE_EMPLOYMENT', 'PERIODIC', 'RETURN_TO_WORK', 'JOB_CHANGE', 'COMPLAINT', 'OTHER']).optional(),
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  physicianName: z.string().trim().optional(),
  institution: z.string().trim().optional(),
  performedAt: z.string().trim().optional(),
  nextDueDate: z.string().trim().optional(),
  result: z.enum(['PENDING', 'FIT', 'FIT_WITH_RESTRICTION', 'TEMPORARILY_UNFIT', 'UNFIT']).optional(),
  restrictionNote: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

// YAZMA için 'update' iznine EK OLARAK 'view_sensitive' aranır: sağlık
// verisi özel nitelikli (KVKK) — bir kaydı görmeye yetkisi olmayan
// kişinin o kaydı OLUŞTURABİLMESİ tutarsız olurdu.
export async function createOccupationalHealthRecordAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session, access } = await requireDepartmentAccess(departmentId, 'update');
  if (!access.permissions.view_sensitive) {
    return { error: 'Sağlık kaydı girmek için özel nitelikli veri yetkisi gerekir.' };
  }

  const parsed = CreateSchema.safeParse({
    employeeId: formData.get('employeeId'),
    recordType: formData.get('recordType'),
    examKind: optionalField(formData, 'examKind'),
    title: formData.get('title'),
    physicianName: optionalField(formData, 'physicianName'),
    institution: optionalField(formData, 'institution'),
    performedAt: optionalField(formData, 'performedAt'),
    nextDueDate: optionalField(formData, 'nextDueDate'),
    result: optionalField(formData, 'result'),
    restrictionNote: optionalField(formData, 'restrictionNote'),
    notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createOccupationalHealthRecord(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Kayıt eklenemedi.' };
  }

  revalidatePath(`/dashboard/departments/${departmentId}/hr/occupational-health`);
  return { success: 'Sağlık kaydı eklendi.' };
}

export async function archiveOccupationalHealthRecordAction(
  departmentId: string,
  recordId: string,
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  const { session, access } = await requireDepartmentAccess(departmentId, 'update');
  if (!access.permissions.view_sensitive) {
    return { error: 'Bu işlem için özel nitelikli veri yetkisi gerekir.' };
  }

  try {
    await archiveOccupationalHealthRecord(session.companyId, recordId);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Arşivlenemedi.' };
  }

  revalidatePath(`/dashboard/departments/${departmentId}/hr/occupational-health`);
  return { success: 'Kayıt arşivlendi.' };
}
