'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createGoodsReceipt, createVendorInvoice, approveVendorInvoice, cancelVendorInvoice } from '@/lib/procurement/receiving';
import { ProcurementError } from '@/lib/procurement/errors';
import { AccountingError } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ProcurementError || err instanceof AccountingError) return err.message;
  return fallback;
}

const ReceiptLineSchema = z.object({
  poLineId: z.string().trim().min(1),
  receivedQty: z.union([z.string(), z.number()]),
  warehouseId: z.string().trim().optional(),
  stockItemId: z.string().trim().optional(),
  counterAccountCode: z.string().trim().optional()
});

const CreateReceiptSchema = z.object({
  poId: z.string().trim().min(1),
  receiptDate: z.string().trim().min(1, 'Tarih gerekli.'),
  notes: z.string().trim().optional(),
  lines: z.array(ReceiptLineSchema).min(1, 'En az bir mal kabul satırı gerekli.')
});

export async function createGoodsReceiptAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz mal kabul satırı verisi.' };
  }
  const parsed = CreateReceiptSchema.safeParse({
    poId: formData.get('poId'), receiptDate: formData.get('receiptDate'), notes: optionalField(formData, 'notes'), lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createGoodsReceipt(session.companyId, parsed.data.poId, session.id, {
      receiptDate: parsed.data.receiptDate, notes: parsed.data.notes,
      lines: parsed.data.lines.map((l) => ({ ...l, warehouseId: l.warehouseId || undefined, stockItemId: l.stockItemId || undefined, counterAccountCode: l.counterAccountCode || undefined }))
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Mal kabul kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  return { success: 'Mal kabul kaydedildi.' };
}

const InvoiceLineSchema = z.object({
  poLineId: z.string().trim().min(1),
  invoicedQty: z.union([z.string(), z.number()]),
  invoicedUnitPrice: z.union([z.string(), z.number()])
});

const CreateInvoiceSchema = z.object({
  poId: z.string().trim().min(1),
  supplierInvoiceNo: z.string().trim().min(1, 'Tedarikçi fatura no gerekli.'),
  invoiceDate: z.string().trim().min(1, 'Tarih gerekli.'),
  currencyCode: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  lines: z.array(InvoiceLineSchema).min(1, 'En az bir fatura satırı gerekli.')
});

export async function createVendorInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz fatura satırı verisi.' };
  }
  const parsed = CreateInvoiceSchema.safeParse({
    poId: formData.get('poId'), supplierInvoiceNo: formData.get('supplierInvoiceNo'), invoiceDate: formData.get('invoiceDate'),
    currencyCode: formData.get('currencyCode'), notes: optionalField(formData, 'notes'), lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let invoiceId: string;
  try {
    invoiceId = await createVendorInvoice(session.companyId, parsed.data.poId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Fatura kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  revalidatePath(`/dashboard/procurement/vendor-invoices/${invoiceId}`);
  return { success: 'Fatura kaydedildi.' };
}

const InvoiceIdSchema = z.object({ invoiceId: z.string().trim().min(1) });

const ApproveInvoiceSchema = InvoiceIdSchema.extend({
  clearingAccountCode: z.string().trim().optional(),
  payableAccountCode: z.string().trim().optional()
});

export async function approveVendorInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ApproveInvoiceSchema.safeParse({
    invoiceId: formData.get('invoiceId'), clearingAccountCode: optionalField(formData, 'clearingAccountCode'), payableAccountCode: optionalField(formData, 'payableAccountCode')
  });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await approveVendorInvoice(session.companyId, parsed.data.invoiceId, session.id, { clearingAccountCode: parsed.data.clearingAccountCode, payableAccountCode: parsed.data.payableAccountCode });
  } catch (err) {
    return { error: toErrorMessage(err, 'Fatura onaylanamadı.') };
  }
  revalidatePath(`/dashboard/procurement/vendor-invoices/${parsed.data.invoiceId}`);
  return { success: 'Fatura onaylandı.' };
}

export async function cancelVendorInvoiceAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = InvoiceIdSchema.safeParse({ invoiceId: formData.get('invoiceId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelVendorInvoice(session.companyId, parsed.data.invoiceId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Fatura iptal edilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/vendor-invoices/${parsed.data.invoiceId}`);
  return { success: 'Fatura iptal edildi.' };
}
