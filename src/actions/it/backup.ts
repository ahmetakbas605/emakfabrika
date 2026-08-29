'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createBackupJob, recordBackupResult } from '@/lib/it/backup';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const JobSchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), source: z.string().trim().min(1, 'Kaynak gerekli.'), destination: z.string().trim().min(1, 'Hedef gerekli.'), schedule: z.string().trim().optional(), retentionDays: z.string().trim().optional() });

export async function createBackupJobAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = JobSchema.safeParse({ assetId: formData.get('assetId'), source: formData.get('source'), destination: formData.get('destination'), schedule: optionalField(formData, 'schedule'), retentionDays: optionalField(formData, 'retentionDays') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createBackupJob(session.companyId, { assetId: parsed.data.assetId, source: parsed.data.source, destination: parsed.data.destination, schedule: parsed.data.schedule, retentionDays: parsed.data.retentionDays ? Number(parsed.data.retentionDays) : undefined });
  revalidatePath(`/dashboard/departments/${departmentId}/it/backup`);
  return { success: 'Yedekleme işi oluşturuldu.' };
}

const ResultSchema = z.object({ backupJobId: z.string().trim().min(1), result: z.enum(['SUCCESS', 'FAILED', 'PARTIAL']), errorMessage: z.string().trim().optional() });

export async function recordBackupResultAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ResultSchema.safeParse({ backupJobId: formData.get('backupJobId'), result: formData.get('result'), errorMessage: optionalField(formData, 'errorMessage') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await recordBackupResult(session.companyId, session.id, { backupJobId: parsed.data.backupJobId, startedAt: new Date(), finishedAt: new Date(), result: parsed.data.result, errorMessage: parsed.data.errorMessage });
  revalidatePath(`/dashboard/departments/${departmentId}/it/backup`);
  return { success: parsed.data.result === 'FAILED' ? 'Sonuç kaydedildi — başarısızlık için otomatik alert/incident açıldı.' : 'Sonuç kaydedildi.' };
}
