'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createProblem, linkIncidentToProblem, updateProblem } from '@/lib/it/problems';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateProblemSchema = z.object({ title: z.string().trim().min(1, 'Başlık gerekli.') });

export async function createProblemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateProblemSchema.safeParse({ title: formData.get('title') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createProblem(session.companyId, { title: parsed.data.title, openedByUserId: session.id });
  revalidatePath(`/dashboard/departments/${departmentId}/it/problems`);
  return { success: 'Problem oluşturuldu.' };
}

const LinkIncidentSchema = z.object({ problemId: z.string().trim().min(1), incidentId: z.string().trim().min(1, 'Incident seçilmeli.') });

export async function linkIncidentToProblemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = LinkIncidentSchema.safeParse({ problemId: formData.get('problemId'), incidentId: formData.get('incidentId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await linkIncidentToProblem(session.companyId, parsed.data.problemId, parsed.data.incidentId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Bağlanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/problems`);
  return { success: 'Incident probleme bağlandı.' };
}

const UpdateProblemSchema = z.object({ problemId: z.string().trim().min(1), toStatus: z.enum(['OPEN', 'ROOT_CAUSE_IDENTIFIED', 'RESOLVED', 'CLOSED']), rootCause: z.string().trim().optional() });

export async function updateProblemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = UpdateProblemSchema.safeParse({ problemId: formData.get('problemId'), toStatus: formData.get('toStatus'), rootCause: optionalField(formData, 'rootCause') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await updateProblem(session.companyId, parsed.data.problemId, parsed.data.toStatus, parsed.data.rootCause);
  revalidatePath(`/dashboard/departments/${departmentId}/it/problems`);
  return { success: 'Problem güncellendi.' };
}
