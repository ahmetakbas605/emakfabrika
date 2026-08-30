'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { runMrp, cancelPlannedOrder } from '@/lib/mrp/engine';
import { convertPlannedOrderToProduction, convertPlannedOrderToPurchaseRequest } from '@/lib/mrp/convert';
import { MrpError } from '@/lib/mrp/errors';
import { setStockItemMinQty } from '@/lib/warehouse';
import { AccountingError } from '@/lib/accounting';
import { ProductionError } from '@/lib/production/errors';
import { ProcurementError } from '@/lib/procurement/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof MrpError || err instanceof ProductionError || err instanceof ProcurementError || err instanceof AccountingError ? err.message : fallback;
}

const RunMrpSchema = z.object({ warehouseId: z.string().trim().min(1, 'Depo gerekli.'), runDate: z.string().trim().min(1, 'Tarih gerekli.') });

export async function runMrpAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RunMrpSchema.safeParse({ warehouseId: formData.get('warehouseId'), runDate: formData.get('runDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let mrpRunId: string;
  try {
    mrpRunId = await runMrp(session.companyId, session.id, parsed.data.warehouseId, parsed.data.runDate);
  } catch (err) {
    return { error: toErrorMessage(err, 'MRP koşusu başarısız oldu.') };
  }
  revalidatePath('/dashboard/mrp');
  return { success: `MRP koşusu tamamlandı (${mrpRunId.slice(0, 8)}...).` };
}

const PlannedOrderIdSchema = z.object({ plannedOrderId: z.string().trim().min(1) });

export async function convertPlannedOrderToProductionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PlannedOrderIdSchema.safeParse({ plannedOrderId: formData.get('plannedOrderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await convertPlannedOrderToProduction(session.companyId, parsed.data.plannedOrderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Üretim emrine dönüştürülemedi.') };
  }
  revalidatePath('/dashboard/mrp');
  return { success: 'Üretim emrine dönüştürüldü.' };
}

export async function convertPlannedOrderToPurchaseRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PlannedOrderIdSchema.safeParse({ plannedOrderId: formData.get('plannedOrderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await convertPlannedOrderToPurchaseRequest(session.companyId, parsed.data.plannedOrderId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Satın alma talebine dönüştürülemedi.') };
  }
  revalidatePath('/dashboard/mrp');
  return { success: 'Satın alma talebine dönüştürüldü.' };
}

export async function cancelPlannedOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PlannedOrderIdSchema.safeParse({ plannedOrderId: formData.get('plannedOrderId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelPlannedOrder(session.companyId, parsed.data.plannedOrderId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/mrp');
  return { success: 'Öneri iptal edildi.' };
}

const SetMinQtySchema = z.object({ stockItemId: z.string().trim().min(1), minQty: z.string().trim().optional() });

export async function setStockItemMinQtyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SetMinQtySchema.safeParse({ stockItemId: formData.get('stockItemId'), minQty: formData.get('minQty') || undefined });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await setStockItemMinQty(session.companyId, parsed.data.stockItemId, parsed.data.minQty ? Number(parsed.data.minQty) : null);
  } catch (err) {
    return { error: toErrorMessage(err, 'Güncellenemedi.') };
  }
  revalidatePath('/dashboard/mrp');
  return { success: 'Minimum stok güncellendi.' };
}
