'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createInvoice, approveInvoice, cancelInvoice } from '@/lib/sales/invoices';
import { SalesError } from '@/lib/sales/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const InvoiceLineSchema = z.object({
  orderLineId: z.string().trim().optional(),
  productId: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRatePercent: z.number().min(0).max(100).optional()
});

const CreateInvoiceSchema = z.object({
  orderId: z.string().trim().optional(),
  partyId: z.string().trim().min(1, 'Cari gerekli.'),
  invoiceDate: z.string().trim().min(1, 'Tarih gerekli.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  lines: z.array(InvoiceLineSchema).min(1, 'En az bir kalem gerekli.')
});

export async function createInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem verisi.' };
  }
  const parsed = CreateInvoiceSchema.safeParse({
    orderId: optionalField(formData, 'orderId'), partyId: formData.get('partyId'), invoiceDate: formData.get('invoiceDate'), currencyCode: formData.get('currencyCode'), lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createInvoice(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Fatura oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/invoices');
  return { success: 'Fatura taslak olarak oluşturuldu.' };
}

const ApproveInvoiceSchema = z.object({
  invoiceId: z.string().trim().min(1),
  revenueAccountCode: z.string().trim().optional(),
  receivableAccountCode: z.string().trim().optional(),
  taxAccountCode: z.string().trim().optional()
});

export async function approveInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ApproveInvoiceSchema.safeParse({
    invoiceId: formData.get('invoiceId'), revenueAccountCode: optionalField(formData, 'revenueAccountCode'),
    receivableAccountCode: optionalField(formData, 'receivableAccountCode'), taxAccountCode: optionalField(formData, 'taxAccountCode')
  });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await approveInvoice(session.companyId, parsed.data.invoiceId, session.id, {
      revenueAccountCode: parsed.data.revenueAccountCode, receivableAccountCode: parsed.data.receivableAccountCode, taxAccountCode: parsed.data.taxAccountCode
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Onaylanamadı.') };
  }
  revalidatePath('/dashboard/sales/invoices');
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Fatura onaylandı.' };
}

const InvoiceIdSchema = z.object({ invoiceId: z.string().trim().min(1) });

export async function cancelInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = InvoiceIdSchema.safeParse({ invoiceId: formData.get('invoiceId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelInvoice(session.companyId, parsed.data.invoiceId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/sales/invoices');
  return { success: 'Fatura iptal edildi.' };
}
