'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createMaintenancePlan, runDueMaintenanceGeneration } from '@/lib/it/maintenance';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreatePlanSchema = z.object({
  assetId: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION']),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
  intervalValue: z.string().trim().optional(),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  assignedTechnicianId: z.string().trim().optional(),
  checklistTemplateId: z.string().trim().optional(),
  estimatedDurationMinutes: z.string().trim().optional()
});

export async function createMaintenancePlanAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = CreatePlanSchema.safeParse({
    assetId: optionalField(formData, 'assetId'), title: formData.get('title'), maintenanceType: formData.get('maintenanceType'),
    frequency: formData.get('frequency'), intervalValue: optionalField(formData, 'intervalValue'), startDate: formData.get('startDate'),
    assignedTechnicianId: optionalField(formData, 'assignedTechnicianId'), checklistTemplateId: optionalField(formData, 'checklistTemplateId'),
    estimatedDurationMinutes: optionalField(formData, 'estimatedDurationMinutes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createMaintenancePlan(session.companyId, {
    assetId: parsed.data.assetId, title: parsed.data.title, maintenanceType: parsed.data.maintenanceType, frequency: parsed.data.frequency,
    intervalValue: parsed.data.intervalValue ? Number(parsed.data.intervalValue) : undefined, startDate: parsed.data.startDate,
    assignedTechnicianId: parsed.data.assignedTechnicianId, checklistTemplateId: parsed.data.checklistTemplateId,
    estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ? Number(parsed.data.estimatedDurationMinutes) : undefined
  });
  revalidatePath(`/dashboard/departments/${departmentId}/it/maintenance`);
  return { success: 'Bakım planı oluşturuldu.' };
}

// MAINTENANCE.md §2 — gerçek bir scheduler bağlanana kadar (TODO:
// SCHEDULER_INFRASTRUCTURE) bu ELLE tetiklenir; mantığın kendisi idempotent
// (UNIQUE kısıtı), cron bağlandığında değişmeden kullanılır.
export async function runDueMaintenanceGenerationAction(departmentId: string, _prevState: FormState): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const result = await runDueMaintenanceGeneration(session.companyId, departmentId, session.id);
  revalidatePath(`/dashboard/departments/${departmentId}/it/maintenance`);
  return { success: result.generatedCount > 0 ? `${result.generatedCount} bakım işi oluşturuldu.` : 'Bugün için vadesi gelen bakım işi yok.' };
}
