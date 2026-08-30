'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createOrder, submitOrder, cancelOrder } from '@/lib/sales/orders';
import { SalesError } from '@/lib/sales/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const OrderLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).optional(),
  taxRatePercent: z.number().min(0).max(100).optional()
});

const CreateOrderSchema = z.object({
  partyId: z.string().trim().min(1, 'Cari gerekli.'),
  orderDate: z.string().trim().min(1, 'Tarih gerekli.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  lines: z.array(OrderLineSchema).min(1, 'En az bir kalem gerekli.')
});

export async function createOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem verisi.' };
  }
  const parsed = CreateOrderSchema.safeParse({ partyId: formData.get('partyId'), orderDate: formData.get('orderDate'), currencyCode: formData.get('currencyCode'), lines: linesRaw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createOrder(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sipariş oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sipariş taslak olarak oluşturuldu — göndermek için "Onaya Gönder"e tıklayın.' };
}

const SubmitOrderSchema = z.object({ orderId: z.string().trim().min(1) });

export async function submitOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitOrderSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitOrder(session.companyId, parsed.data.orderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sipariş onaya gönderildi.' };
}

export async function cancelOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitOrderSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelOrder(session.companyId, parsed.data.orderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sipariş iptal edildi.' };
}
