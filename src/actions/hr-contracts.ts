'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createEmployeeContract } from '@/lib/hr/contracts';
import { uploadAttachment } from '@/lib/documents/attachments';
import { HrError } from '@/lib/hr/errors';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateContractSchema = z.object({
  contractType: z.enum(['INDEFINITE', 'DEFINITE', 'PART_TIME', 'INTERNSHIP', 'CONSULTANT']),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  endDate: z.string().trim().optional(),
  probationEndDate: z.string().trim().optional(),
  weeklyWorkingHours: z.string().trim().optional(),
  terms: z.string().trim().optional()
});

export async function createEmployeeContractAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = CreateContractSchema.safeParse({
    contractType: formData.get('contractType'), startDate: formData.get('startDate'),
    endDate: optionalField(formData, 'endDate'), probationEndDate: optionalField(formData, 'probationEndDate'),
    weeklyWorkingHours: optionalField(formData, 'weeklyWorkingHours'), terms: optionalField(formData, 'terms')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const contractId = await createEmployeeContract(session.companyId, employeeId, session.id, {
      contractType: parsed.data.contractType, startDate: parsed.data.startDate, endDate: parsed.data.endDate, probationEndDate: parsed.data.probationEndDate,
      weeklyWorkingHours: parsed.data.weeklyWorkingHours ? Number(parsed.data.weeklyWorkingHours) : undefined, terms: parsed.data.terms
    });

    const file = formData.get('file');
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadAttachment(session.companyId, {
        entityType: 'EMPLOYEE_CONTRACT', entityId: contractId, fileName: file.name, mimeType: file.type || 'application/octet-stream',
        buffer, uploadedByUserId: session.id, documentCategory: 'SÖZLEŞME', issueDate: parsed.data.startDate
      });
    }
  } catch (err) {
    return { error: err instanceof HrError || err instanceof CoreError ? err.message : 'Sözleşme kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Sözleşme kaydedildi.' };
}
