'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createIncident, linkTicketToIncident, changeIncidentStatus } from '@/lib/it/incidents';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateIncidentSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
});

export async function createIncidentAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateIncidentSchema.safeParse({ title: formData.get('title'), description: optionalField(formData, 'description'), severity: optionalField(formData, 'severity') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createIncident(session.companyId, { ...parsed.data, openedByUserId: session.id });
  revalidatePath(`/dashboard/departments/${departmentId}/it/incidents`);
  return { success: 'Incident oluşturuldu.' };
}

const LinkTicketSchema = z.object({ ticketId: z.string().trim().min(1, 'Ticket seçilmeli.'), incidentId: z.string().trim().min(1) });

export async function linkTicketToIncidentAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = LinkTicketSchema.safeParse({ ticketId: formData.get('ticketId'), incidentId: formData.get('incidentId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await linkTicketToIncident(session.companyId, parsed.data.ticketId, parsed.data.incidentId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Bağlanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/incidents`);
  return { success: 'Ticket incident\'a bağlandı.' };
}

const ChangeStatusSchema = z.object({ incidentId: z.string().trim().min(1), toStatus: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']) });

export async function changeIncidentStatusAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ChangeStatusSchema.safeParse({ incidentId: formData.get('incidentId'), toStatus: formData.get('toStatus') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await changeIncidentStatus(session.companyId, parsed.data.incidentId, parsed.data.toStatus);
  revalidatePath(`/dashboard/departments/${departmentId}/it/incidents`);
  return { success: 'Durum güncellendi.' };
}
