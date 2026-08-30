'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createShift, assignEmployeeShift } from '@/lib/hr/shifts';
import { createDevice, recordManualPunch, processAttendanceForDate } from '@/lib/hr/pdks';
import { HrError } from '@/lib/hr/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateShiftSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  startTime: z.string().trim().min(1, 'Başlangıç saati gerekli.'),
  endTime: z.string().trim().min(1, 'Bitiş saati gerekli.'),
  breakMinutes: z.string().trim().optional(),
  graceMinutes: z.string().trim().optional(),
  crossesMidnight: z.string().trim().optional()
});

export async function createShiftAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateShiftSchema.safeParse({
    code: formData.get('code'), name: formData.get('name'), startTime: formData.get('startTime'), endTime: formData.get('endTime'),
    breakMinutes: optionalField(formData, 'breakMinutes'), graceMinutes: optionalField(formData, 'graceMinutes'), crossesMidnight: optionalField(formData, 'crossesMidnight')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createShift(session.companyId, {
      code: parsed.data.code, name: parsed.data.name, startTime: parsed.data.startTime, endTime: parsed.data.endTime,
      breakMinutes: parsed.data.breakMinutes ? Number(parsed.data.breakMinutes) : undefined,
      graceMinutes: parsed.data.graceMinutes ? Number(parsed.data.graceMinutes) : undefined,
      crossesMidnight: parsed.data.crossesMidnight === 'on'
    });
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Vardiya kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/pdks`);
  return { success: 'Vardiya kaydedildi.' };
}

const AssignShiftSchema = z.object({ employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'), shiftId: z.string().trim().optional() });

export async function assignEmployeeShiftAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = AssignShiftSchema.safeParse({ employeeId: formData.get('employeeId'), shiftId: optionalField(formData, 'shiftId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await assignEmployeeShift(session.companyId, parsed.data.employeeId, parsed.data.shiftId ?? null);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Atanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/pdks`);
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${parsed.data.employeeId}`);
  return { success: 'Vardiya ataması güncellendi.' };
}

const CreateDeviceSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  adapterType: z.enum(['MANUAL', 'GENERIC_RFID', 'ZKTECO', 'HIKVISION']).optional()
});

export async function createDeviceAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateDeviceSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), adapterType: optionalField(formData, 'adapterType') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createDevice(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Cihaz kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/pdks`);
  return { success: 'Cihaz kaydedildi.' };
}

const RecordPunchSchema = z.object({
  deviceId: z.string().trim().min(1, 'Cihaz seçilmeli.'),
  employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'),
  punchAt: z.string().trim().min(1, 'Tarih/saat gerekli.'),
  direction: z.enum(['IN', 'OUT', 'UNKNOWN'])
});

export async function recordManualPunchAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = RecordPunchSchema.safeParse({ deviceId: formData.get('deviceId'), employeeId: formData.get('employeeId'), punchAt: formData.get('punchAt'), direction: formData.get('direction') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordManualPunch(session.companyId, session.id, { deviceId: parsed.data.deviceId, employeeId: parsed.data.employeeId, punchAt: new Date(parsed.data.punchAt), direction: parsed.data.direction });
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Kayıt eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/pdks`);
  return { success: 'Giriş/çıkış kaydı eklendi.' };
}

const ProcessAttendanceSchema = z.object({ employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'), workDate: z.string().trim().min(1, 'Tarih gerekli.') });

export async function processAttendanceAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = ProcessAttendanceSchema.safeParse({ employeeId: formData.get('employeeId'), workDate: formData.get('workDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await processAttendanceForDate(session.companyId, parsed.data.employeeId, parsed.data.workDate);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'İşlenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/pdks`);
  return { success: 'Yoklama kaydı işlendi.' };
}
