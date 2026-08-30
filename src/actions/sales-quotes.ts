'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createQuote, setQuoteStatus } from '@/lib/sales/quotes';
import { createOrderFromQuote } from '@/lib/sales/orders';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const QuoteLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).optional(),
  taxRatePercent: z.number().min(0).max(100).optional()
});

const CreateQuoteSchema = z.object({
  partyId: z.string().trim().min(1, 'Cari gerekli.'),
  opportunityId: z.string().trim().optional(),
  quoteDate: z.string().trim().min(1, 'Tarih gerekli.'),
  validUntil: z.string().trim().optional(),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  lines: z.array(QuoteLineSchema).min(1, 'En az bir kalem gerekli.')
});

// StockTransferForm/TicketWorkLogForm İLE AYNI desen — client'ta biriktirilen
// dinamik satır listesi tek bir gizli input'a JSON.stringify edilerek gönderilir.
export async function createQuoteAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem verisi.' };
  }
  const parsed = CreateQuoteSchema.safeParse({
    partyId: formData.get('partyId'), opportunityId: optionalField(formData, 'opportunityId'), quoteDate: formData.get('quoteDate'),
    validUntil: optionalField(formData, 'validUntil'), currencyCode: formData.get('currencyCode'), lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createQuote(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Teklif oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/quotes');
  return { success: 'Teklif oluşturuldu.' };
}

const SetQuoteStatusSchema = z.object({ quoteId: z.string().trim().min(1), status: z.enum(['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']) });

export async function setQuoteStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SetQuoteStatusSchema.safeParse({ quoteId: formData.get('quoteId'), status: formData.get('status') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setQuoteStatus(session.companyId, parsed.data.quoteId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Durum güncellenemedi.') };
  }
  revalidatePath('/dashboard/sales/quotes');
  return { success: 'Durum güncellendi.' };
}

const ConvertQuoteSchema = z.object({ quoteId: z.string().trim().min(1) });

export async function convertQuoteToOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ConvertQuoteSchema.safeParse({ quoteId: formData.get('quoteId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await createOrderFromQuote(session.companyId, session.id, parsed.data.quoteId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Siparişe dönüştürülemedi.') };
  }
  revalidatePath('/dashboard/sales/quotes');
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Teklif siparişe dönüştürüldü.' };
}
