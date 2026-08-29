'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { storeCredential } from '@/lib/it/network-credentials';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CredentialSchema = z.object({ assetId: z.string().trim().optional(), credentialType: z.enum(['SSH', 'SNMP_COMMUNITY', 'API_KEY', 'VPN']), label: z.string().trim().min(1, 'Etiket gerekli.'), secret: z.string().trim().min(1, 'Sır gerekli.') });

export async function storeCredentialAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'manage_credentials');
  const parsed = CredentialSchema.safeParse({ assetId: optionalField(formData, 'assetId'), credentialType: formData.get('credentialType'), label: formData.get('label'), secret: formData.get('secret') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await storeCredential(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/credentials`);
  return { success: 'Kimlik bilgisi şifrelenerek kaydedildi.' };
}
