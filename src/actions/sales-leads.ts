'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createLead, updateLeadStatus, convertLeadToOpportunity } from '@/lib/sales/leads';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const CreateLeadSchema = z.object({
  contactName: z.string().trim().min(1, 'İletişim adı gerekli.'),
  companyName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  source: z.string().trim().optional()
});

export async function createLeadAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateLeadSchema.safeParse({
    contactName: formData.get('contactName'), companyName: optionalField(formData, 'companyName'), email: optionalField(formData, 'email'),
    phone: optionalField(formData, 'phone'), source: optionalField(formData, 'source')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createLead(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Aday müşteri oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/leads');
  return { success: 'Aday müşteri eklendi.' };
}

const UpdateLeadStatusSchema = z.object({ leadId: z.string().trim().min(1), status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED']) });

export async function updateLeadStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = UpdateLeadStatusSchema.safeParse({ leadId: formData.get('leadId'), status: formData.get('status') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await updateLeadStatus(session.companyId, parsed.data.leadId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Durum güncellenemedi.') };
  }
  revalidatePath('/dashboard/sales/leads');
  return { success: 'Durum güncellendi.' };
}

const ConvertLeadSchema = z.object({
  leadId: z.string().trim().min(1),
  opportunityName: z.string().trim().min(1, 'Fırsat adı gerekli.'),
  estimatedValue: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  expectedCloseDate: z.string().trim().optional(),
  existingPartyId: z.string().trim().optional()
});

export async function convertLeadAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ConvertLeadSchema.safeParse({
    leadId: formData.get('leadId'), opportunityName: formData.get('opportunityName'), estimatedValue: optionalField(formData, 'estimatedValue'),
    currencyCode: optionalField(formData, 'currencyCode'), expectedCloseDate: optionalField(formData, 'expectedCloseDate'), existingPartyId: optionalField(formData, 'existingPartyId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await convertLeadToOpportunity(session.companyId, parsed.data.leadId, session.id, {
      opportunityName: parsed.data.opportunityName, estimatedValue: parsed.data.estimatedValue ? Number(parsed.data.estimatedValue) : undefined,
      currencyCode: parsed.data.currencyCode, expectedCloseDate: parsed.data.expectedCloseDate, existingPartyId: parsed.data.existingPartyId
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Dönüştürülemedi.') };
  }
  revalidatePath('/dashboard/sales/leads');
  revalidatePath('/dashboard/sales/opportunities');
  return { success: 'Aday müşteri fırsata dönüştürüldü.' };
}
