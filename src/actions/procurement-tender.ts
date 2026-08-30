'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createTender, publishTender, cancelTender, submitTenderBid, openTenderBidding } from '@/lib/procurement/tender';
import { createAwardFromTender } from '@/lib/procurement/award';
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

const TenderBidLineSchema = z.object({
  tenderLineId: z.string().trim().min(1),
  unitPrice: z.union([z.string(), z.number()]),
  discountPercent: z.union([z.string(), z.number()]).optional(),
  deliveryDays: z.union([z.string(), z.number()]).optional(),
  isAlternative: z.string().trim().optional(),
  alternativeDescription: z.string().trim().optional()
});

const SubmitTenderBidSchema = z.object({
  tenderId: z.string().trim().min(1),
  supplierPartyId: z.string().trim().min(1, 'Tedarikçi seçin.'),
  currencyCode: z.string().trim().min(1),
  validUntil: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  deliveryDays: z.union([z.string(), z.number()]).optional(),
  bidBondReference: z.string().trim().optional(),
  lines: z.array(TenderBidLineSchema).min(1, 'En az bir teklif satırı gerekli.')
});

export async function submitTenderBidAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz teklif satırı verisi.' };
  }
  const parsed = SubmitTenderBidSchema.safeParse({
    tenderId: formData.get('tenderId'), supplierPartyId: formData.get('supplierPartyId'), currencyCode: formData.get('currencyCode'),
    validUntil: optionalField(formData, 'validUntil'), paymentTerms: optionalField(formData, 'paymentTerms'), deliveryDays: optionalField(formData, 'deliveryDays'),
    bidBondReference: optionalField(formData, 'bidBondReference'), lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await submitTenderBid(session.companyId, parsed.data.tenderId, parsed.data.supplierPartyId, session.id, {
      currencyCode: parsed.data.currencyCode, validUntil: parsed.data.validUntil, paymentTerms: parsed.data.paymentTerms,
      deliveryDays: parsed.data.deliveryDays === undefined ? undefined : Number(parsed.data.deliveryDays),
      bidBondReference: parsed.data.bidBondReference,
      lines: parsed.data.lines.map((l) => ({ ...l, isAlternative: l.isAlternative === 'on', deliveryDays: l.deliveryDays === undefined ? undefined : Number(l.deliveryDays) }))
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Teklif kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/tenders/${parsed.data.tenderId}`);
  return { success: 'Teklif kaydedildi.' };
}

export async function openTenderBiddingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = TenderIdSchema.safeParse({ tenderId: formData.get('tenderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await openTenderBidding(session.companyId, parsed.data.tenderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Teklifler açılamadı.') };
  }
  revalidatePath(`/dashboard/procurement/tenders/${parsed.data.tenderId}`);
  return { success: 'Teklifler açıldı.' };
}

const TenderAwardLineSchema = z.object({
  tenderLineId: z.string().trim().min(1),
  supplierPartyId: z.string().trim().min(1),
  tenderBidLineId: z.string().trim().min(1),
  awardedQty: z.union([z.string(), z.number()])
});

const CreateTenderAwardSchema = z.object({
  tenderId: z.string().trim().min(1),
  lines: z.array(TenderAwardLineSchema).min(1, 'En az bir ödül satırı gerekli.')
});

export async function createTenderAwardAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz ödül satırı verisi.' };
  }
  const parsed = CreateTenderAwardSchema.safeParse({ tenderId: formData.get('tenderId'), lines: linesRaw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let awardId: string;
  try {
    awardId = await createAwardFromTender(session.companyId, session.id, parsed.data.tenderId, { lines: parsed.data.lines });
  } catch (err) {
    return { error: toErrorMessage(err, 'Ödül oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/procurement/tenders/${parsed.data.tenderId}`);
  revalidatePath(`/dashboard/procurement/awards/${awardId}`);
  return { success: 'Ödül taslağı oluşturuldu.' };
}
