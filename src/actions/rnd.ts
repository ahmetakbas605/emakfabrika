'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createPrototype, updatePrototypeStatus } from '@/lib/rnd/prototypes';
import { createLabTest, updateLabTestStatus } from '@/lib/rnd/labtests';
import { RndError } from '@/lib/rnd/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof RndError ? err.message : fallback;
}

const CreatePrototypeSchema = z.object({ projectId: z.string().trim().optional(), name: z.string().trim().min(1, 'Ad gerekli.'), description: z.string().trim().optional() });

export async function createPrototypeAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreatePrototypeSchema.safeParse({ projectId: optionalField(formData, 'projectId'), name: formData.get('name'), description: optionalField(formData, 'description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createPrototype(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Prototip oluşturulamadı.') };
  }
  revalidatePath('/dashboard/rnd');
  return { success: 'Prototip oluşturuldu.' };
}

const PrototypeStatusSchema = z.object({ prototypeId: z.string().trim().min(1), status: z.enum(['DESIGN', 'BUILDING', 'TESTING', 'APPROVED', 'REJECTED']) });

export async function updatePrototypeStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PrototypeStatusSchema.safeParse({ prototypeId: formData.get('prototypeId'), status: formData.get('status') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await updatePrototypeStatus(session.companyId, parsed.data.prototypeId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Prototip durumu güncellenemedi.') };
  }
  revalidatePath('/dashboard/rnd');
  return { success: 'Prototip durumu güncellendi.' };
}

const CreateLabTestSchema = z.object({ prototypeId: z.string().trim().optional(), testName: z.string().trim().min(1, 'Test adı gerekli.'), testDate: z.string().trim().optional() });

export async function createLabTestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateLabTestSchema.safeParse({ prototypeId: optionalField(formData, 'prototypeId'), testName: formData.get('testName'), testDate: optionalField(formData, 'testDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createLabTest(session.companyId, { ...parsed.data, performedByUserId: session.id });
  } catch (err) {
    return { error: toErrorMessage(err, 'Laboratuvar testi oluşturulamadı.') };
  }
  revalidatePath('/dashboard/rnd');
  return { success: 'Laboratuvar testi oluşturuldu.' };
}

const LabTestStatusSchema = z.object({
  testId: z.string().trim().min(1), status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED']), resultSummary: z.string().trim().optional()
});

export async function updateLabTestStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = LabTestStatusSchema.safeParse({ testId: formData.get('testId'), status: formData.get('status'), resultSummary: optionalField(formData, 'resultSummary') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await updateLabTestStatus(session.companyId, parsed.data.testId, { status: parsed.data.status, resultSummary: parsed.data.resultSummary });
  } catch (err) {
    return { error: toErrorMessage(err, 'Test durumu güncellenemedi.') };
  }
  revalidatePath('/dashboard/rnd');
  return { success: 'Test durumu güncellendi.' };
}
