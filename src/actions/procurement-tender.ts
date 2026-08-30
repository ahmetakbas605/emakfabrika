'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createTender, publishTender, cancelTender } from '@/lib/procurement/tender';
import { ProcurementError } from '@/lib/procurement/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProcurementError ? err.message : fallback;
}

const TenderLineSchema = z.object({
  srcRequestLineId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  description: z.string().trim().min(1),
  quantity: z.union([z.string(), z.number()]),
  unitId: z.string().trim().min(1)
});

const CreateTenderSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().optional(),
  bidSubmissionDeadline: z.string().trim().optional(),
  bidOpeningAt: z.string().trim().optional(),
  deliveryLocation: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  warrantyRequirement: z.string().trim().optional(),
  bidBondRequired: z.string().trim().optional(),
  bidBondPercent: z.string().trim().optional(),
  bidBondAmount: z.string().trim().optional(),
  openParticipation: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(TenderLineSchema).min(1, 'En az bir kalem gerekli.'),
  supplierPartyIds: z.array(z.string().trim().min(1))
});

export async function createTenderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  let supplierIdsRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
    supplierIdsRaw = JSON.parse(String(formData.get('supplierPartyIdsJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem/tedarikçi verisi.' };
  }
  const parsed = CreateTenderSchema.safeParse({
    title: formData.get('title'), description: optionalField(formData, 'description'),
    bidSubmissionDeadline: optionalField(formData, 'bidSubmissionDeadline'), bidOpeningAt: optionalField(formData, 'bidOpeningAt'),
    deliveryLocation: optionalField(formData, 'deliveryLocation'), paymentTerms: optionalField(formData, 'paymentTerms'), warrantyRequirement: optionalField(formData, 'warrantyRequirement'),
    bidBondRequired: optionalField(formData, 'bidBondRequired'), bidBondPercent: optionalField(formData, 'bidBondPercent'), bidBondAmount: optionalField(formData, 'bidBondAmount'),
    openParticipation: optionalField(formData, 'openParticipation'), notes: optionalField(formData, 'notes'),
    lines: linesRaw, supplierPartyIds: supplierIdsRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let tenderId: string;
  try {
    tenderId = await createTender(session.companyId, session.id, {
      title: parsed.data.title, description: parsed.data.description,
      bidSubmissionDeadline: parsed.data.bidSubmissionDeadline ? new Date(parsed.data.bidSubmissionDeadline) : undefined,
      bidOpeningAt: parsed.data.bidOpeningAt ? new Date(parsed.data.bidOpeningAt) : undefined,
      deliveryLocation: parsed.data.deliveryLocation, paymentTerms: parsed.data.paymentTerms, warrantyRequirement: parsed.data.warrantyRequirement,
      bidBondRequired: parsed.data.bidBondRequired === 'on', bidBondPercent: parsed.data.bidBondPercent || undefined, bidBondAmount: parsed.data.bidBondAmount || undefined,
      openParticipation: parsed.data.openParticipation === 'on', notes: parsed.data.notes,
      lines: parsed.data.lines, supplierPartyIds: parsed.data.supplierPartyIds
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'İhale oluşturulamadı.') };
  }
  revalidatePath('/dashboard/procurement/tenders');
  revalidatePath(`/dashboard/procurement/tenders/${tenderId}`);
  return { success: 'İhale taslağı oluşturuldu.' };
}

const TenderIdSchema = z.object({ tenderId: z.string().trim().min(1) });

export async function publishTenderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = TenderIdSchema.safeParse({ tenderId: formData.get('tenderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await publishTender(session.companyId, parsed.data.tenderId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İhale yayınlanamadı.') };
  }
  revalidatePath(`/dashboard/procurement/tenders/${parsed.data.tenderId}`);
  return { success: 'İhale yayınlandı.' };
}

export async function cancelTenderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = TenderIdSchema.safeParse({ tenderId: formData.get('tenderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelTender(session.companyId, parsed.data.tenderId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İhale iptal edilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/tenders/${parsed.data.tenderId}`);
  return { success: 'İhale iptal edildi.' };
}
