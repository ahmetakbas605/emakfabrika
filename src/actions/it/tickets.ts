'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createTicket, transitionTicket, reopenTicket, assignTicket, addComment, logWork, createSlaPolicy } from '@/lib/it/tickets';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateTicketSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  ticketType: z.enum(['STANDARD', 'FIELD_SERVICE']).optional(),
  relatedAssetId: z.string().trim().optional()
});

export async function createTicketAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateTicketSchema.safeParse({
    title: formData.get('title'),
    description: optionalField(formData, 'description'),
    category: optionalField(formData, 'category'),
    priority: optionalField(formData, 'priority'),
    ticketType: optionalField(formData, 'ticketType'),
    relatedAssetId: optionalField(formData, 'relatedAssetId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createTicket(session.companyId, departmentId, { ...parsed.data, requestedByUserId: session.id });
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Ticket oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  return { success: 'Ticket oluşturuldu.' };
}

const TransitionSchema = z.object({ ticketId: z.string().trim().min(1), toStatus: z.string().trim().min(1), note: z.string().trim().optional() });

export async function transitionTicketAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = TransitionSchema.safeParse({ ticketId: formData.get('ticketId'), toStatus: formData.get('toStatus'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await transitionTicket(session.companyId, parsed.data.ticketId, parsed.data.toStatus, session.id, parsed.data.note);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Durum değiştirilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets/${parsed.data.ticketId}`);
  return { success: 'Durum güncellendi.' };
}

const ReopenSchema = z.object({ ticketId: z.string().trim().min(1), note: z.string().trim().optional() });

// SERVICE-DESK.md §1, madde 207 — CLOSED'dan çıkış AYRI bir yetki gerektirir.
export async function reopenTicketAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'approve');
  const parsed = ReopenSchema.safeParse({ ticketId: formData.get('ticketId'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await reopenTicket(session.companyId, parsed.data.ticketId, session.id, parsed.data.note);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Yeniden açılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets/${parsed.data.ticketId}`);
  return { success: 'Ticket yeniden açıldı.' };
}

const AssignTicketSchema = z.object({ ticketId: z.string().trim().min(1), userId: z.string().trim().min(1, 'Kullanıcı seçilmeli.'), role: z.enum(['LEADER', 'MEMBER']) });

export async function assignTicketAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = AssignTicketSchema.safeParse({ ticketId: formData.get('ticketId'), userId: formData.get('userId'), role: formData.get('role') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await assignTicket(session.companyId, parsed.data.ticketId, parsed.data.userId, parsed.data.role, session.id);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Atama yapılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets/${parsed.data.ticketId}`);
  return { success: 'Atama yapıldı.' };
}

const CommentSchema = z.object({ ticketId: z.string().trim().min(1), body: z.string().trim().min(1, 'Yorum boş olamaz.'), isInternal: z.string().trim().optional() });

export async function addCommentAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = CommentSchema.safeParse({ ticketId: formData.get('ticketId'), body: formData.get('body'), isInternal: optionalField(formData, 'isInternal') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addComment(parsed.data.ticketId, session.id, parsed.data.body, parsed.data.isInternal === 'on');
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Yorum eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets/${parsed.data.ticketId}`);
  return { success: 'Yorum eklendi.' };
}

const WorkLogSchema = z.object({ ticketId: z.string().trim().min(1), minutesSpent: z.string().trim().min(1, 'Süre gerekli.'), note: z.string().trim().optional() });

export async function logWorkAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = WorkLogSchema.safeParse({ ticketId: formData.get('ticketId'), minutesSpent: formData.get('minutesSpent'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await logWork(parsed.data.ticketId, session.id, Number(parsed.data.minutesSpent), parsed.data.note);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'İş kaydı eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets/${parsed.data.ticketId}`);
  return { success: 'İş kaydı eklendi.' };
}

const SlaPolicySchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli.'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  responseMinutes: z.string().trim().min(1),
  resolutionHours: z.string().trim().min(1)
});

export async function createSlaPolicyAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = SlaPolicySchema.safeParse({ name: formData.get('name'), priority: formData.get('priority'), responseMinutes: formData.get('responseMinutes'), resolutionHours: formData.get('resolutionHours') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createSlaPolicy(session.companyId, { name: parsed.data.name, priority: parsed.data.priority, responseMinutes: Number(parsed.data.responseMinutes), resolutionHours: Number(parsed.data.resolutionHours) });
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'SLA politikası oluşturulamadı — bu öncelik için zaten bir politika olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  return { success: 'SLA politikası oluşturuldu.' };
}
