'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession, requireFactoryAdmin } from '@/lib/dal';
import { setScoringWeights, submitTechnicalEvaluation, submitCommercialEvaluation } from '@/lib/procurement/evaluation';
import { ProcurementError } from '@/lib/procurement/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProcurementError ? err.message : fallback;
}

const WeightsSchema = z.object({
  priceWeight: z.string().trim().min(1),
  technicalWeight: z.string().trim().min(1),
  deliveryWeight: z.string().trim().min(1),
  commercialWeight: z.string().trim().min(1)
});

// Ağırlıklar şirket geneli bir POLİTİKA — factory admin gerektiriyor
// (workflow kurallarıyla AYNI yetki seviyesi).
export async function setScoringWeightsAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = WeightsSchema.safeParse({
    priceWeight: formData.get('priceWeight'),
    technicalWeight: formData.get('technicalWeight'),
    deliveryWeight: formData.get('deliveryWeight'),
    commercialWeight: formData.get('commercialWeight')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setScoringWeights(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Ağırlıklar kaydedilemedi.') };
  }
  revalidatePath('/dashboard/procurement/scoring-weights');
  return { success: 'Ağırlıklar kaydedildi.' };
}

const TechEvalSchema = z.object({
  quotationLineId: z.string().trim().min(1),
  rfqId: z.string().trim().min(1),
  complianceStatus: z.enum(['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'ALTERNATIVE_ACCEPTED', 'REJECTED']),
  reason: z.string().trim().optional()
});

export async function submitTechnicalEvaluationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = TechEvalSchema.safeParse({
    quotationLineId: formData.get('quotationLineId'),
    rfqId: formData.get('rfqId'),
    complianceStatus: formData.get('complianceStatus'),
    reason: optionalField(formData, 'reason')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await submitTechnicalEvaluation(session.companyId, parsed.data.quotationLineId, session.id, { complianceStatus: parsed.data.complianceStatus, reason: parsed.data.reason });
  } catch (err) {
    return { error: toErrorMessage(err, 'Değerlendirme kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}/evaluate`);
  return { success: 'Teknik değerlendirme kaydedildi.' };
}

const CommEvalSchema = z.object({
  quotationId: z.string().trim().min(1),
  rfqId: z.string().trim().min(1),
  score: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

export async function submitCommercialEvaluationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CommEvalSchema.safeParse({
    quotationId: formData.get('quotationId'),
    rfqId: formData.get('rfqId'),
    score: formData.get('score'),
    notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await submitCommercialEvaluation(session.companyId, parsed.data.quotationId, session.id, { score: parsed.data.score, notes: parsed.data.notes });
  } catch (err) {
    return { error: toErrorMessage(err, 'Değerlendirme kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}/evaluate`);
  return { success: 'Ticari değerlendirme kaydedildi.' };
}
