'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createMachine } from '@/lib/mes/machines';
import { recordDowntimeStart, recordDowntimeEnd } from '@/lib/mes/downtime';
import { MesError } from '@/lib/mes/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof MesError ? err.message : fallback;
}

const CreateMachineSchema = z.object({
  workCenterId: z.string().trim().min(1, 'İş merkezi gerekli.'),
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  idealCycleTimeSeconds: z.string().trim().optional()
});

export async function createMachineAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateMachineSchema.safeParse({
    workCenterId: formData.get('workCenterId'), code: formData.get('code'), name: formData.get('name'), idealCycleTimeSeconds: optionalField(formData, 'idealCycleTimeSeconds')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createMachine(session.companyId, { workCenterId: parsed.data.workCenterId, code: parsed.data.code, name: parsed.data.name, idealCycleTimeSeconds: parsed.data.idealCycleTimeSeconds ? Number(parsed.data.idealCycleTimeSeconds) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Makine oluşturulamadı.') };
  }
  revalidatePath('/dashboard/mes');
  return { success: 'Makine oluşturuldu.' };
}

const StartDowntimeSchema = z.object({
  machineId: z.string().trim().min(1, 'Makine gerekli.'),
  operationId: z.string().trim().optional(),
  reasonCode: z.string().trim().min(1, 'Neden gerekli.'),
  notes: z.string().trim().optional()
});

export async function recordDowntimeStartAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = StartDowntimeSchema.safeParse({
    machineId: formData.get('machineId'), operationId: optionalField(formData, 'operationId'), reasonCode: formData.get('reasonCode'), notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordDowntimeStart(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Duruş kaydedilemedi.') };
  }
  revalidatePath('/dashboard/mes');
  return { success: 'Duruş başlatıldı.' };
}

const EndDowntimeSchema = z.object({ downtimeId: z.string().trim().min(1) });

export async function recordDowntimeEndAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = EndDowntimeSchema.safeParse({ downtimeId: formData.get('downtimeId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await recordDowntimeEnd(session.companyId, parsed.data.downtimeId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Duruş kapatılamadı.') };
  }
  revalidatePath('/dashboard/mes');
  return { success: 'Duruş kapatıldı.' };
}
