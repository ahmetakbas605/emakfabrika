'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createProductionOrder, submitProductionOrder, cancelProductionOrder } from '@/lib/production/orders';
import { ProductionError } from '@/lib/production/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductionError ? err.message : fallback;
}

const CreateProductionOrderSchema = z.object({
  productId: z.string().trim().min(1, 'Ürün gerekli.'),
  quantity: z.string().trim().min(1, 'Miktar gerekli.'),
  unitId: z.string().trim().min(1, 'Birim gerekli.'),
  warehouseId: z.string().trim().min(1, 'Depo gerekli.'),
  plannedStartDate: z.string().trim().optional(),
  plannedEndDate: z.string().trim().optional()
});

export async function createProductionOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateProductionOrderSchema.safeParse({
    productId: formData.get('productId'), quantity: formData.get('quantity'), unitId: formData.get('unitId'), warehouseId: formData.get('warehouseId'),
    plannedStartDate: optionalField(formData, 'plannedStartDate'), plannedEndDate: optionalField(formData, 'plannedEndDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createProductionOrder(session.companyId, session.id, { ...parsed.data, quantity: Number(parsed.data.quantity) });
  } catch (err) {
    return { error: toErrorMessage(err, 'Üretim emri oluşturulamadı.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Üretim emri taslak olarak oluşturuldu — göndermek için "Onaya Gönder"e tıklayın.' };
}

const OrderIdSchema = z.object({ orderId: z.string().trim().min(1) });

export async function submitProductionOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = OrderIdSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitProductionOrder(session.companyId, parsed.data.orderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Üretim emri onaya gönderildi.' };
}

export async function cancelProductionOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = OrderIdSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelProductionOrder(session.companyId, parsed.data.orderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Üretim emri iptal edildi.' };
}
