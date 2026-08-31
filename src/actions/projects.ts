'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createProject, createProjectTask, completeProjectTask, createMilestone, completeMilestone } from '@/lib/projects/projects';
import { createProgressPayment, approveProgressPayment, markProgressPaymentPaid } from '@/lib/projects/progress-payments';
import { ProjectError } from '@/lib/projects/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProjectError ? err.message : fallback;
}

const CreateProjectSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  description: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  budgetAmount: z.string().trim().optional(),
  managerUserId: z.string().trim().optional(),
  departmentId: z.string().trim().optional()
});

export async function createProjectAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateProjectSchema.safeParse({
    code: formData.get('code'), name: formData.get('name'), description: optionalField(formData, 'description'), startDate: optionalField(formData, 'startDate'),
    endDate: optionalField(formData, 'endDate'), budgetAmount: optionalField(formData, 'budgetAmount'), managerUserId: optionalField(formData, 'managerUserId'),
    departmentId: optionalField(formData, 'departmentId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProject(session.companyId, session.id, { ...parsed.data, budgetAmount: parsed.data.budgetAmount ? Number(parsed.data.budgetAmount) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Proje oluşturulamadı.') };
  }
  revalidatePath('/dashboard/projects');
  return { success: 'Proje oluşturuldu.' };
}

const CreateProjectTaskSchema = z.object({
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Görev adı gerekli.'),
  parentTaskId: z.string().trim().optional(),
  assignedToUserId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional()
});

export async function createProjectTaskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateProjectTaskSchema.safeParse({
    projectId: formData.get('projectId'), name: formData.get('name'), parentTaskId: optionalField(formData, 'parentTaskId'),
    assignedToUserId: optionalField(formData, 'assignedToUserId'), startDate: optionalField(formData, 'startDate'), dueDate: optionalField(formData, 'dueDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProjectTask(session.companyId, parsed.data.projectId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Görev oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Görev oluşturuldu.' };
}

const TaskIdSchema = z.object({ taskId: z.string().trim().min(1), projectId: z.string().trim().min(1) });

export async function completeProjectTaskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = TaskIdSchema.safeParse({ taskId: formData.get('taskId'), projectId: formData.get('projectId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await completeProjectTask(session.companyId, parsed.data.taskId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Görev tamamlanamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Görev tamamlandı.' };
}

const CreateMilestoneSchema = z.object({ projectId: z.string().trim().min(1), name: z.string().trim().min(1, 'Ad gerekli.'), targetDate: z.string().trim().min(1, 'Hedef tarih gerekli.') });

export async function createMilestoneAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateMilestoneSchema.safeParse({ projectId: formData.get('projectId'), name: formData.get('name'), targetDate: formData.get('targetDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createMilestone(session.companyId, parsed.data.projectId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Milestone oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Milestone oluşturuldu.' };
}

const MilestoneIdSchema = z.object({ milestoneId: z.string().trim().min(1), projectId: z.string().trim().min(1) });

export async function completeMilestoneAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = MilestoneIdSchema.safeParse({ milestoneId: formData.get('milestoneId'), projectId: formData.get('projectId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await completeMilestone(session.companyId, parsed.data.milestoneId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Milestone tamamlanamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Milestone tamamlandı.' };
}

const CreateProgressPaymentSchema = z.object({
  projectId: z.string().trim().min(1),
  milestoneId: z.string().trim().optional(),
  periodStart: z.string().trim().min(1, 'Dönem başlangıcı gerekli.'),
  periodEnd: z.string().trim().min(1, 'Dönem bitişi gerekli.'),
  amount: z.coerce.number().positive('Tutar pozitif olmalı.'),
  notes: z.string().trim().optional()
});

export async function createProgressPaymentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateProgressPaymentSchema.safeParse({
    projectId: formData.get('projectId'), milestoneId: optionalField(formData, 'milestoneId'), periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'), amount: formData.get('amount'), notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProgressPayment(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Hakediş oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Hakediş oluşturuldu.' };
}

const PaymentIdSchema = z.object({ paymentId: z.string().trim().min(1), projectId: z.string().trim().min(1) });

export async function approveProgressPaymentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PaymentIdSchema.safeParse({ paymentId: formData.get('paymentId'), projectId: formData.get('projectId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await approveProgressPayment(session.companyId, parsed.data.paymentId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Hakediş onaylanamadı.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Hakediş onaylandı.' };
}

const MarkPaidSchema = z.object({ paymentId: z.string().trim().min(1), projectId: z.string().trim().min(1), paymentDate: z.string().trim().min(1, 'Ödeme tarihi gerekli.') });

export async function markProgressPaymentPaidAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = MarkPaidSchema.safeParse({ paymentId: formData.get('paymentId'), projectId: formData.get('projectId'), paymentDate: formData.get('paymentDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await markProgressPaymentPaid(session.companyId, parsed.data.paymentId, { paymentDate: parsed.data.paymentDate });
  } catch (err) {
    return { error: toErrorMessage(err, 'Hakediş ödendi olarak işaretlenemedi.') };
  }
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { success: 'Hakediş ödendi olarak işaretlendi.' };
}
