'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createTarget, recordMetric, createAlert, updateAlertStatus } from '@/lib/it/monitoring';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const TargetSchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), targetType: z.enum(['PING', 'SNMP', 'SERVICE', 'PORT']), intervalSeconds: z.string().trim().optional() });

export async function createTargetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'monitor');
  const parsed = TargetSchema.safeParse({ assetId: formData.get('assetId'), targetType: formData.get('targetType'), intervalSeconds: optionalField(formData, 'intervalSeconds') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createTarget(session.companyId, { assetId: parsed.data.assetId, targetType: parsed.data.targetType, intervalSeconds: parsed.data.intervalSeconds ? Number(parsed.data.intervalSeconds) : undefined });
  revalidatePath(`/dashboard/departments/${departmentId}/it/monitoring`);
  return { success: 'İzleme hedefi eklendi.' };
}

const MetricSchema = z.object({ targetId: z.string().trim().min(1), metricName: z.string().trim().min(1, 'Metrik adı gerekli.'), value: z.string().trim().min(1, 'Değer gerekli.') });

export async function recordMetricAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'monitor');
  const parsed = MetricSchema.safeParse({ targetId: formData.get('targetId'), metricName: formData.get('metricName'), value: formData.get('value') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await recordMetric(parsed.data.targetId, parsed.data.metricName, parsed.data.value);
  revalidatePath(`/dashboard/departments/${departmentId}/it/monitoring`);
  return { success: 'Ölçüm kaydedildi.' };
}

const AlertSchema = z.object({ targetId: z.string().trim().min(1, 'Hedef seçilmeli.'), severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']), message: z.string().trim().min(1, 'Mesaj gerekli.') });

export async function createAlertAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'monitor');
  const parsed = AlertSchema.safeParse({ targetId: formData.get('targetId'), severity: formData.get('severity'), message: formData.get('message') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const result = await createAlert(session.companyId, session.id, parsed.data.targetId, parsed.data.severity, parsed.data.message);
  revalidatePath(`/dashboard/departments/${departmentId}/it/monitoring`);
  return { success: result.isFirstInGroup ? 'Alert oluşturuldu, yeni bir incident açıldı.' : 'Alert mevcut korelasyon grubuna eklendi (aynı incident kullanılıyor).' };
}

const AlertStatusSchema = z.object({ alertId: z.string().trim().min(1), status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']) });

export async function updateAlertStatusAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'monitor');
  const parsed = AlertStatusSchema.safeParse({ alertId: formData.get('alertId'), status: formData.get('status') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await updateAlertStatus(session.companyId, parsed.data.alertId, parsed.data.status);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Güncellenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/monitoring`);
  return { success: 'Durum güncellendi.' };
}
