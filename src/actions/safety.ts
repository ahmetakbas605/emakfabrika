'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createIncident, startIncidentInvestigation, closeIncident } from '@/lib/safety/incidents';
import { SafetyError } from '@/lib/safety/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SafetyError ? err.message : fallback;
}

const CreateIncidentSchema = z.object({
  incidentType: z.enum(['ACCIDENT', 'NEAR_MISS', 'OCCUPATIONAL_ILLNESS']),
  severity: z.enum(['MINOR', 'MODERATE', 'SEVERE', 'FATAL']).optional(),
  incidentDate: z.string().trim().min(1, 'Tarih gerekli.'),
  location: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  description: z.string().trim().min(1, 'Açıklama gerekli.')
});

export async function createIncidentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateIncidentSchema.safeParse({
    incidentType: formData.get('incidentType'), severity: optionalField(formData, 'severity'), incidentDate: formData.get('incidentDate'),
    location: optionalField(formData, 'location'), employeeId: optionalField(formData, 'employeeId'), description: formData.get('description')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createIncident(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Olay kaydı oluşturulamadı.') };
  }
  revalidatePath('/dashboard/safety');
  return { success: 'Olay kaydı oluşturuldu.' };
}

const IncidentIdSchema = z.object({ incidentId: z.string().trim().min(1) });

export async function startIncidentInvestigationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = IncidentIdSchema.safeParse({ incidentId: formData.get('incidentId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await startIncidentInvestigation(session.companyId, parsed.data.incidentId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Soruşturma başlatılamadı.') };
  }
  revalidatePath('/dashboard/safety');
  return { success: 'Soruşturma başlatıldı.' };
}

const CloseIncidentSchema = z.object({
  incidentId: z.string().trim().min(1), rootCause: z.string().trim().min(1, 'Kök neden gerekli.'), correctiveAction: z.string().trim().min(1, 'Düzeltici faaliyet gerekli.')
});

export async function closeIncidentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CloseIncidentSchema.safeParse({ incidentId: formData.get('incidentId'), rootCause: formData.get('rootCause'), correctiveAction: formData.get('correctiveAction') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await closeIncident(session.companyId, parsed.data.incidentId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Olay kaydı kapatılamadı.') };
  }
  revalidatePath('/dashboard/safety');
  return { success: 'Olay kaydı kapatıldı.' };
}
