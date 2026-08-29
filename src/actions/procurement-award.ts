'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createAward, submitAward, cancelAward } from '@/lib/procurement/award';
import { ProcurementError } from '@/lib/procurement/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProcurementError ? err.message : fallback;
}

const AwardLineSchema = z.object({
  rfqLineId: z.string().trim().min(1),
  supplierPartyId: z.string().trim().min(1),
  quotationLineId: z.string().trim().min(1),
  awardedQty: z.union([z.string(), z.number()])
});

const CreateAwardSchema = z.object({
  rfqId: z.string().trim().min(1),
  lines: z.array(AwardLineSchema).min(1, 'En az bir ödül satırı gerekli.')
});

export async function createAwardAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz ödül satırı verisi.' };
  }
  const parsed = CreateAwardSchema.safeParse({ rfqId: formData.get('rfqId'), lines: linesRaw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let awardId: string;
  try {
    awardId = await createAward(session.companyId, session.id, parsed.data.rfqId, { lines: parsed.data.lines });
  } catch (err) {
    return { error: toErrorMessage(err, 'Ödül oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}`);
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}/award`);
  revalidatePath(`/dashboard/procurement/awards/${awardId}`);
  return { success: 'Ödül taslağı oluşturuldu.' };
}

const AwardIdSchema = z.object({ awardId: z.string().trim().min(1) });

export async function submitAwardAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = AwardIdSchema.safeParse({ awardId: formData.get('awardId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitAward(session.companyId, parsed.data.awardId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Ödül gönderilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/awards/${parsed.data.awardId}`);
  return { success: 'Ödül onaya gönderildi.' };
}

export async function cancelAwardAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = AwardIdSchema.safeParse({ awardId: formData.get('awardId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelAward(session.companyId, parsed.data.awardId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Ödül iptal edilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/awards/${parsed.data.awardId}`);
  return { success: 'Ödül iptal edildi.' };
}
