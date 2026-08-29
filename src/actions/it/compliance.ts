'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { recordCompliance } from '@/lib/it/compliance';

export type FormState = { error?: string; success?: string } | undefined;

const STATUS = z.enum(['COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN']);
const ComplianceSchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), antivirusStatus: STATUS, firewallStatus: STATUS, encryptionStatus: STATUS, patchStatus: STATUS, osSupportStatus: STATUS });

export async function recordComplianceAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'monitor');
  const parsed = ComplianceSchema.safeParse({
    assetId: formData.get('assetId'), antivirusStatus: formData.get('antivirusStatus'), firewallStatus: formData.get('firewallStatus'),
    encryptionStatus: formData.get('encryptionStatus'), patchStatus: formData.get('patchStatus'), osSupportStatus: formData.get('osSupportStatus')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await recordCompliance(parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/compliance`);
  return { success: 'Uyumluluk kaydı eklendi.' };
}
