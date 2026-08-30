'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createShipment, dispatchShipment, markShipmentDelivered, cancelShipment } from '@/lib/sales/shipments';
import { SalesError } from '@/lib/sales/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SalesError ? err.message : fallback;
}

const ShipmentLineSchema = z.object({ orderLineId: z.string().trim().min(1), quantity: z.number().positive() });

const CreateShipmentSchema = z.object({
  orderId: z.string().trim().min(1),
  warehouseId: z.string().trim().min(1, 'Depo gerekli.'),
  shipmentDate: z.string().trim().min(1, 'Tarih gerekli.'),
  lines: z.array(ShipmentLineSchema).min(1, 'En az bir kalem gerekli.')
});

export async function createShipmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem verisi.' };
  }
  const parsed = CreateShipmentSchema.safeParse({ orderId: formData.get('orderId'), warehouseId: formData.get('warehouseId'), shipmentDate: formData.get('shipmentDate'), lines: linesRaw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createShipment(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sevkiyat oluşturulamadı.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sevkiyat hazırlandı — göndermek için "Sevk Et"e tıklayın.' };
}

const ShipmentIdSchema = z.object({ shipmentId: z.string().trim().min(1) });

export async function dispatchShipmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ShipmentIdSchema.safeParse({ shipmentId: formData.get('shipmentId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await dispatchShipment(session.companyId, parsed.data.shipmentId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sevk edilemedi.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sevkiyat gönderildi — stok hareketi işlendi.' };
}

export async function markShipmentDeliveredAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ShipmentIdSchema.safeParse({ shipmentId: formData.get('shipmentId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await markShipmentDelivered(session.companyId, parsed.data.shipmentId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İşaretlenemedi.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Teslim edildi olarak işaretlendi.' };
}

export async function cancelShipmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ShipmentIdSchema.safeParse({ shipmentId: formData.get('shipmentId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelShipment(session.companyId, parsed.data.shipmentId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/sales/orders');
  return { success: 'Sevkiyat iptal edildi.' };
}
