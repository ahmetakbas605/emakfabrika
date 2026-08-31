'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createVehicle, createVehicleInsurance } from '@/lib/fleet/vehicles';
import { recordVehicleExpense } from '@/lib/fleet/expenses';
import { createMaintenancePlan, runDueMaintenanceGeneration } from '@/lib/it/maintenance';
import { listCompanyDepartments } from '@/lib/departments';
import { FleetError } from '@/lib/fleet/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof FleetError ? err.message : fallback;
}

const CreateVehicleSchema = z.object({
  plateNo: z.string().trim().min(1, 'Plaka gerekli.'),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.string().trim().optional(),
  vin: z.string().trim().optional(),
  fuelType: z.enum(['GASOLINE', 'DIESEL', 'LPG', 'ELECTRIC', 'HYBRID']).optional(),
  registrationExpiryDate: z.string().trim().optional(),
  departmentId: z.string().trim().optional()
});

export async function createVehicleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateVehicleSchema.safeParse({
    plateNo: formData.get('plateNo'), brand: optionalField(formData, 'brand'), model: optionalField(formData, 'model'), year: optionalField(formData, 'year'),
    vin: optionalField(formData, 'vin'), fuelType: optionalField(formData, 'fuelType'), registrationExpiryDate: optionalField(formData, 'registrationExpiryDate'),
    departmentId: optionalField(formData, 'departmentId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createVehicle(session.companyId, { ...parsed.data, year: parsed.data.year ? Number(parsed.data.year) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Araç oluşturulamadı.') };
  }
  revalidatePath('/dashboard/fleet');
  return { success: 'Araç oluşturuldu.' };
}

const CreateVehicleInsuranceSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Araç seçilmeli.'),
  policyNo: z.string().trim().min(1, 'Poliçe no gerekli.'),
  provider: z.string().trim().optional(),
  coverageType: z.string().trim().optional(),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  endDate: z.string().trim().min(1, 'Bitiş tarihi gerekli.'),
  premium: z.string().trim().optional()
});

export async function createVehicleInsuranceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateVehicleInsuranceSchema.safeParse({
    vehicleId: formData.get('vehicleId'), policyNo: formData.get('policyNo'), provider: optionalField(formData, 'provider'), coverageType: optionalField(formData, 'coverageType'),
    startDate: formData.get('startDate'), endDate: formData.get('endDate'), premium: optionalField(formData, 'premium')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createVehicleInsurance(session.companyId, { ...parsed.data, premium: parsed.data.premium ? Number(parsed.data.premium) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Poliçe oluşturulamadı.') };
  }
  revalidatePath('/dashboard/fleet');
  return { success: 'Sigorta poliçesi oluşturuldu.' };
}

const CreateFleetMaintenancePlanSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Araç seçilmeli.'),
  departmentId: z.string().trim().min(1, 'Sorumlu departman seçilmeli.'),
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION']),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
  intervalValue: z.string().trim().optional(),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.')
});

export async function createFleetMaintenancePlanAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateFleetMaintenancePlanSchema.safeParse({
    vehicleId: formData.get('vehicleId'), departmentId: formData.get('departmentId'), title: formData.get('title'), maintenanceType: formData.get('maintenanceType'),
    frequency: formData.get('frequency'), intervalValue: optionalField(formData, 'intervalValue'), startDate: formData.get('startDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createMaintenancePlan(session.companyId, {
      vehicleId: parsed.data.vehicleId, departmentId: parsed.data.departmentId, title: parsed.data.title, maintenanceType: parsed.data.maintenanceType,
      frequency: parsed.data.frequency, intervalValue: parsed.data.intervalValue ? Number(parsed.data.intervalValue) : undefined, startDate: parsed.data.startDate
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Bakım planı oluşturulamadı.') };
  }
  revalidatePath('/dashboard/fleet');
  return { success: 'Bakım planı oluşturuldu.' };
}

// actions/eam.ts:runEamMaintenanceGenerationAction İLE AYNI desen — TEK
// lib/it/maintenance.ts:runDueMaintenanceGeneration motoru, yalnızca hangi
// sayfadan tetiklendiğini ayırt eden ince bir aksiyon sarmalayıcısı.
export async function runFleetMaintenanceGenerationAction(_prevState: FormState): Promise<FormState> {
  const session = await requireSession();
  const departments = await listCompanyDepartments(session.companyId);
  const fallbackDepartmentId = departments[0]?.id;
  if (!fallbackDepartmentId) return { error: 'Şirkette hiç departman yok.' };

  const result = await runDueMaintenanceGeneration(session.companyId, fallbackDepartmentId, session.id);
  revalidatePath('/dashboard/fleet');
  return { success: result.generatedCount > 0 ? `${result.generatedCount} bakım işi oluşturuldu.` : 'Bugün için vadesi gelen bakım işi yok.' };
}

const RecordVehicleExpenseSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Araç seçilmeli.'),
  expenseType: z.enum(['FUEL', 'HGS', 'TOLL', 'WASH', 'PARKING', 'OTHER']),
  expenseDate: z.string().trim().min(1, 'Tarih gerekli.'),
  amount: z.coerce.number().positive('Tutar pozitif olmalı.'),
  quantity: z.string().trim().optional(),
  odometerKm: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export async function recordVehicleExpenseAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordVehicleExpenseSchema.safeParse({
    vehicleId: formData.get('vehicleId'), expenseType: formData.get('expenseType'), expenseDate: formData.get('expenseDate'), amount: formData.get('amount'),
    quantity: optionalField(formData, 'quantity'), odometerKm: optionalField(formData, 'odometerKm'), notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordVehicleExpense(session.companyId, session.id, {
      ...parsed.data, quantity: parsed.data.quantity ? Number(parsed.data.quantity) : undefined, odometerKm: parsed.data.odometerKm ? Number(parsed.data.odometerKm) : undefined
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Gider kaydedilemedi.') };
  }
  revalidatePath('/dashboard/fleet/expenses');
  return { success: 'Gider kaydedildi.' };
}
