'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createOpportunity, setOpportunityStage } from '@/lib/sales/opportunities';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const CreateOpportunitySchema = z.object({
  partyId: z.string().trim().min(1, 'Cari gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  estimatedValue: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  expectedCloseDate: z.string().trim().optional()
});

export async function createOpportunityAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateOpportunitySchema.safeParse({
    partyId: formData.get('partyId'), name: formData.get('name'), estimatedValue: optionalField(formData, 'estimatedValue'),
    currencyCode: optionalField(formData, 'currencyCode'), expectedCloseDate: optionalField(formData, 'expectedCloseDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createOpportunity(session.companyId, session.id, { ...parsed.data, estimatedValue: parsed.data.estimatedValue ? Number(parsed.data.estimatedValue) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Fırsat oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/opportunities');
  return { success: 'Fırsat oluşturuldu.' };
}

const SetStageSchema = z.object({
  opportunityId: z.string().trim().min(1),
  stage: z.enum(['NEW', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
  lostReason: z.string().trim().optional()
});

export async function setOpportunityStageAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SetStageSchema.safeParse({ opportunityId: formData.get('opportunityId'), stage: formData.get('stage'), lostReason: optionalField(formData, 'lostReason') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setOpportunityStage(session.companyId, parsed.data.opportunityId, parsed.data.stage, parsed.data.lostReason);
  } catch (err) {
    return { error: toErrorMessage(err, 'Aşama güncellenemedi.') };
  }
  revalidatePath('/dashboard/sales/opportunities');
  return { success: 'Aşama güncellendi.' };
}
