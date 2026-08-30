'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createEmployeeQualification, revokeEmployeeQualification } from '@/lib/hr/qualifications';
import { uploadAttachment } from '@/lib/documents/attachments';
import { HrError } from '@/lib/hr/errors';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const DOCUMENT_CATEGORY_BY_TYPE: Record<string, string> = { DIPLOMA: 'DİPLOMA', CERTIFICATE: 'SERTİFİKA', TRAINING: 'EĞİTİM', LICENSE: 'LİSANS', OTHER: 'DİĞER' };

const CreateQualificationSchema = z.object({
  qualificationType: z.enum(['DIPLOMA', 'CERTIFICATE', 'TRAINING', 'LICENSE', 'OTHER']),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  institution: z.string().trim().optional(),
  fieldOfStudy: z.string().trim().optional(),
  credentialNumber: z.string().trim().optional(),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional()
});

export async function createEmployeeQualificationAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = CreateQualificationSchema.safeParse({
    qualificationType: formData.get('qualificationType'), name: formData.get('name'),
    institution: optionalField(formData, 'institution'), fieldOfStudy: optionalField(formData, 'fieldOfStudy'),
    credentialNumber: optionalField(formData, 'credentialNumber'), issueDate: optionalField(formData, 'issueDate'), expiryDate: optionalField(formData, 'expiryDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const qualificationId = await createEmployeeQualification(session.companyId, employeeId, parsed.data);

    const file = formData.get('file');
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadAttachment(session.companyId, {
        entityType: 'EMPLOYEE_QUALIFICATION', entityId: qualificationId, fileName: file.name, mimeType: file.type || 'application/octet-stream',
        buffer, uploadedByUserId: session.id, documentCategory: DOCUMENT_CATEGORY_BY_TYPE[parsed.data.qualificationType],
        issueDate: parsed.data.issueDate, expiryDate: parsed.data.expiryDate
      });
    }
  } catch (err) {
    return { error: err instanceof HrError || err instanceof CoreError ? err.message : 'Kayıt eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Belge/eğitim kaydı eklendi.' };
}

export async function revokeEmployeeQualificationAction(departmentId: string, employeeId: string, qualificationId: string, _prevState: FormState, _formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  try {
    await revokeEmployeeQualification(session.companyId, qualificationId);
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'İptal edilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Kayıt iptal edildi.' };
}
