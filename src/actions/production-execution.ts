'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { issueProductionMaterials, startProdOperation, completeProdOperation, completeProductionOrder } from '@/lib/production/execution';
import { ProductionError } from '@/lib/production/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductionError ? err.message : fallback;
}

const IssueMaterialsSchema = z.object({ orderId: z.string().trim().min(1), transactionDate: z.string().trim().min(1, 'Tarih gerekli.'), counterAccountCode: z.string().trim().optional() });

export async function issueProductionMaterialsAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = IssueMaterialsSchema.safeParse({ orderId: formData.get('orderId'), transactionDate: formData.get('transactionDate'), counterAccountCode: optionalField(formData, 'counterAccountCode') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await issueProductionMaterials(session.companyId, parsed.data.orderId, session.id, { transactionDate: parsed.data.transactionDate, counterAccountCode: parsed.data.counterAccountCode });
  } catch (err) {
    return { error: toErrorMessage(err, 'Malzeme çıkışı yapılamadı.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Malzeme çıkışı yapıldı.' };
}

const OperationIdSchema = z.object({ operationId: z.string().trim().min(1) });

export async function startProdOperationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = OperationIdSchema.safeParse({ operationId: formData.get('operationId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await startProdOperation(session.companyId, parsed.data.operationId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Başlatılamadı.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Operasyon başlatıldı.' };
}

const CompleteOperationSchema = z.object({ operationId: z.string().trim().min(1), goodQuantity: z.string().trim().min(1, 'Miktar gerekli.'), scrapQuantity: z.string().trim().optional() });

export async function completeProdOperationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CompleteOperationSchema.safeParse({ operationId: formData.get('operationId'), goodQuantity: formData.get('goodQuantity'), scrapQuantity: optionalField(formData, 'scrapQuantity') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await completeProdOperation(session.companyId, parsed.data.operationId, { goodQuantity: Number(parsed.data.goodQuantity), scrapQuantity: parsed.data.scrapQuantity ? Number(parsed.data.scrapQuantity) : undefined });
  } catch (err) {
    return { error: toErrorMessage(err, 'Tamamlanamadı.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Operasyon tamamlandı.' };
}

const CompleteOrderSchema = z.object({
  orderId: z.string().trim().min(1), goodQuantity: z.string().trim().min(1, 'Miktar gerekli.'), scrapQuantity: z.string().trim().optional(),
  transactionDate: z.string().trim().min(1, 'Tarih gerekli.'), unitCost: z.string().trim().optional(), counterAccountCode: z.string().trim().optional()
});

export async function completeProductionOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CompleteOrderSchema.safeParse({
    orderId: formData.get('orderId'), goodQuantity: formData.get('goodQuantity'), scrapQuantity: optionalField(formData, 'scrapQuantity'),
    transactionDate: formData.get('transactionDate'), unitCost: optionalField(formData, 'unitCost'), counterAccountCode: optionalField(formData, 'counterAccountCode')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await completeProductionOrder(session.companyId, parsed.data.orderId, session.id, {
      goodQuantity: Number(parsed.data.goodQuantity), scrapQuantity: parsed.data.scrapQuantity ? Number(parsed.data.scrapQuantity) : undefined,
      transactionDate: parsed.data.transactionDate, unitCost: parsed.data.unitCost ? Number(parsed.data.unitCost) : undefined, counterAccountCode: parsed.data.counterAccountCode
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Tamamlanamadı.') };
  }
  revalidatePath('/dashboard/production/orders');
  return { success: 'Üretim emri tamamlandı — mamul stoğa girdi.' };
}
