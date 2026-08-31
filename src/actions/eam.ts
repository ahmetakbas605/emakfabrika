'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createEamAsset } from '@/lib/eam/assets';
import { createEnergyMeter, recordEnergyReading } from '@/lib/eam/energy';
import { createMaintenancePlan, runDueMaintenanceGeneration } from '@/lib/it/maintenance';
import { listCompanyDepartments } from '@/lib/departments';
import { EamError } from '@/lib/eam/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof EamError ? err.message : fallback;
}

const CreateEamAssetSchema = z.object({
  assetTypeCode: z.string().trim().min(1, 'Ekipman tipi gerekli.'),
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  branchId: z.string().trim().optional(),
  locationNote: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  model: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  departmentId: z.string().trim().optional()
});

export async function createEamAssetAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateEamAssetSchema.safeParse({
    assetTypeCode: formData.get('assetTypeCode'), code: formData.get('code'), name: formData.get('name'), branchId: optionalField(formData, 'branchId'),
    locationNote: optionalField(formData, 'locationNote'), manufacturer: optionalField(formData, 'manufacturer'), model: optionalField(formData, 'model'),
    serialNumber: optionalField(formData, 'serialNumber'), departmentId: optionalField(formData, 'departmentId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createEamAsset(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Ekipman oluşturulamadı.') };
  }
  revalidatePath('/dashboard/eam');
  return { success: 'Ekipman/varlık oluşturuldu.' };
}

const CreateEamMaintenancePlanSchema = z.object({
  eamAssetId: z.string().trim().min(1, 'Ekipman seçilmeli.'),
  departmentId: z.string().trim().min(1, 'Sorumlu departman seçilmeli.'),
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION']),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
  intervalValue: z.string().trim().optional(),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.')
});

export async function createEamMaintenancePlanAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateEamMaintenancePlanSchema.safeParse({
    eamAssetId: formData.get('eamAssetId'), departmentId: formData.get('departmentId'), title: formData.get('title'), maintenanceType: formData.get('maintenanceType'),
    frequency: formData.get('frequency'), intervalValue: optionalField(formData, 'intervalValue'), startDate: formData.get('startDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createMaintenancePlan(session.companyId, {
      eamAssetId: parsed.data.eamAssetId, departmentId: parsed.data.departmentId, title: parsed.data.title, maintenanceType: parsed.data.maintenanceType,
      frequency: parsed.data.frequency, intervalValue: parsed.data.intervalValue ? Number(parsed.data.intervalValue) : undefined, startDate: parsed.data.startDate
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Bakım planı oluşturulamadı.') };
  }
  revalidatePath('/dashboard/eam');
  return { success: 'Bakım planı oluşturuldu.' };
}

// lib/it/maintenance.ts:runDueMaintenanceGeneration TEK motor — bu, IT'nin
// actions/it/maintenance.ts:runDueMaintenanceGenerationAction'ının
// requireDepartmentAccess'ine KARŞIN, EAM'in diğer Faz 4/5 modülleriyle
// (MES/Kalite) AYNI şirket-geneli requireSession() erişimini kullanır —
// fallbackDepartmentId yalnızca departmanı BOŞ (yani IT'ye ait) planlar
// için anlamlı, gerçek EAM planları zaten kendi departmanını taşır.
export async function runEamMaintenanceGenerationAction(_prevState: FormState): Promise<FormState> {
  const session = await requireSession();
  const departments = await listCompanyDepartments(session.companyId);
  const fallbackDepartmentId = departments[0]?.id;
  if (!fallbackDepartmentId) return { error: 'Şirkette hiç departman yok.' };

  const result = await runDueMaintenanceGeneration(session.companyId, fallbackDepartmentId, session.id);
  revalidatePath('/dashboard/eam');
  return { success: result.generatedCount > 0 ? `${result.generatedCount} bakım işi oluşturuldu.` : 'Bugün için vadesi gelen bakım işi yok.' };
}

const CreateEnergyMeterSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  energyType: z.enum(['ELECTRICITY', 'NATURAL_GAS', 'WATER', 'STEAM', 'COMPRESSED_AIR']),
  unit: z.string().trim().min(1, 'Birim gerekli.'),
  workCenterId: z.string().trim().optional(),
  eamAssetId: z.string().trim().optional()
});

export async function createEnergyMeterAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateEnergyMeterSchema.safeParse({
    code: formData.get('code'), name: formData.get('name'), energyType: formData.get('energyType'), unit: formData.get('unit'),
    workCenterId: optionalField(formData, 'workCenterId'), eamAssetId: optionalField(formData, 'eamAssetId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createEnergyMeter(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sayaç oluşturulamadı.') };
  }
  revalidatePath('/dashboard/eam/energy');
  return { success: 'Sayaç oluşturuldu.' };
}

const RecordEnergyReadingSchema = z.object({
  meterId: z.string().trim().min(1, 'Sayaç seçilmeli.'),
  periodStart: z.string().trim().min(1, 'Dönem başlangıcı gerekli.'),
  periodEnd: z.string().trim().min(1, 'Dönem bitişi gerekli.'),
  consumption: z.coerce.number().positive('Tüketim pozitif olmalı.'),
  cost: z.string().trim().optional()
});

export async function recordEnergyReadingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordEnergyReadingSchema.safeParse({
    meterId: formData.get('meterId'), periodStart: formData.get('periodStart'), periodEnd: formData.get('periodEnd'),
    consumption: formData.get('consumption'), cost: optionalField(formData, 'cost')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordEnergyReading(session.companyId, session.id, { ...parsed.data, cost: parsed.data.cost ? Number(parsed.data.cost) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Tüketim kaydedilemedi.') };
  }
  revalidatePath('/dashboard/eam/energy');
  return { success: 'Tüketim kaydedildi.' };
}
