'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createRfq, sendRfq, closeRfq, submitQuotation, type CreateRfqLineInput, type SubmitQuotationLineInput } from '@/lib/procurement/rfq';
import { ProcurementError } from '@/lib/procurement/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProcurementError ? err.message : fallback;
}

const RfqLineSchema = z.object({
  srcRequestLineId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  description: z.string().trim().min(1),
  quantity: z.string().trim().min(1),
  unitId: z.string().trim().min(1)
});

const CreateRfqSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().optional(),
  quotationDeadline: z.string().trim().optional(),
  deliveryLocation: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  warrantyRequirement: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(RfqLineSchema).min(1, 'En az bir kalem gerekli.'),
  supplierPartyIds: z.array(z.string().trim().min(1)).min(1, 'En az bir tedarikçi davet edilmeli.')
});

// StockTransferForm İLE AYNI desen — dinamik satır/tedarikçi listesi
// client'ta biriktirilir, gizli input'a JSON.stringify edilerek gönderilir.
export async function createRfqAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  let suppliersRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
    suppliersRaw = JSON.parse(String(formData.get('suppliersJson') || '[]'));
  } catch {
    return { error: 'Geçersiz form verisi.' };
  }
  const parsed = CreateRfqSchema.safeParse({
    title: formData.get('title'),
    description: optionalField(formData, 'description'),
    quotationDeadline: optionalField(formData, 'quotationDeadline'),
    deliveryLocation: optionalField(formData, 'deliveryLocation'),
    paymentTerms: optionalField(formData, 'paymentTerms'),
    warrantyRequirement: optionalField(formData, 'warrantyRequirement'),
    notes: optionalField(formData, 'notes'),
    lines: linesRaw,
    supplierPartyIds: suppliersRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const lines: CreateRfqLineInput[] = parsed.data.lines.map((l) => ({
      srcRequestLineId: l.srcRequestLineId || undefined,
      productId: l.productId || undefined,
      description: l.description,
      quantity: l.quantity,
      unitId: l.unitId
    }));
    await createRfq(session.companyId, session.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      quotationDeadline: parsed.data.quotationDeadline ? new Date(parsed.data.quotationDeadline) : undefined,
      deliveryLocation: parsed.data.deliveryLocation,
      paymentTerms: parsed.data.paymentTerms,
      warrantyRequirement: parsed.data.warrantyRequirement,
      notes: parsed.data.notes,
      lines,
      supplierPartyIds: parsed.data.supplierPartyIds
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'RFQ oluşturulamadı.') };
  }
  revalidatePath('/dashboard/procurement/rfqs');
  revalidatePath('/dashboard/procurement/queue');
  return { success: 'RFQ oluşturuldu.' };
}

const RfqIdSchema = z.object({ rfqId: z.string().trim().min(1) });

export async function sendRfqAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RfqIdSchema.safeParse({ rfqId: formData.get('rfqId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await sendRfq(session.companyId, parsed.data.rfqId);
  } catch (err) {
    return { error: toErrorMessage(err, 'RFQ gönderilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}`);
  return { success: 'RFQ tedarikçilere gönderildi.' };
}

export async function closeRfqAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RfqIdSchema.safeParse({ rfqId: formData.get('rfqId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await closeRfq(session.companyId, parsed.data.rfqId);
  } catch (err) {
    return { error: toErrorMessage(err, 'RFQ kapatılamadı.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}`);
  return { success: 'Teklif toplama kapatıldı.' };
}

const QuotationLineSchema = z.object({
  rfqLineId: z.string().trim().min(1),
  unitPrice: z.string().trim().min(1),
  discountPercent: z.string().trim().optional(),
  taxPercent: z.string().trim().optional(),
  deliveryDays: z.string().trim().optional(),
  isAlternative: z.string().trim().optional(),
  alternativeDescription: z.string().trim().optional()
});

const SubmitQuotationSchema = z.object({
  rfqId: z.string().trim().min(1),
  supplierPartyId: z.string().trim().min(1, 'Tedarikçi seçilmeli.'),
  currencyCode: z.string().trim().min(1),
  validUntil: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  deliveryDays: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(QuotationLineSchema).min(1, 'En az bir teklif satırı gerekli.')
});

export async function submitQuotationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz satır verisi.' };
  }
  const parsed = SubmitQuotationSchema.safeParse({
    rfqId: formData.get('rfqId'),
    supplierPartyId: formData.get('supplierPartyId'),
    currencyCode: formData.get('currencyCode'),
    validUntil: optionalField(formData, 'validUntil'),
    paymentTerms: optionalField(formData, 'paymentTerms'),
    deliveryDays: optionalField(formData, 'deliveryDays'),
    notes: optionalField(formData, 'notes'),
    lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const lines: SubmitQuotationLineInput[] = parsed.data.lines.map((l) => ({
      rfqLineId: l.rfqLineId,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent || undefined,
      taxPercent: l.taxPercent || undefined,
      deliveryDays: l.deliveryDays ? Number(l.deliveryDays) : undefined,
      isAlternative: l.isAlternative === 'on',
      alternativeDescription: l.alternativeDescription
    }));
    await submitQuotation(session.companyId, parsed.data.rfqId, parsed.data.supplierPartyId, session.id, {
      currencyCode: parsed.data.currencyCode,
      validUntil: parsed.data.validUntil,
      paymentTerms: parsed.data.paymentTerms,
      deliveryDays: parsed.data.deliveryDays ? Number(parsed.data.deliveryDays) : undefined,
      notes: parsed.data.notes,
      lines
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Teklif kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/rfqs/${parsed.data.rfqId}`);
  return { success: 'Teklif kaydedildi.' };
}
