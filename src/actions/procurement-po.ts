'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createPurchaseOrdersFromAward, issuePurchaseOrder, acknowledgePurchaseOrder, cancelPurchaseOrder, addPoAttachment } from '@/lib/procurement/purchaseOrder';
import { ProcurementError } from '@/lib/procurement/errors';
import { CoreError } from '@/lib/core/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ProcurementError || err instanceof CoreError) return err.message;
  return fallback;
}

const AwardIdSchema = z.object({ awardId: z.string().trim().min(1) });

export async function createPurchaseOrdersFromAwardAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = AwardIdSchema.safeParse({ awardId: formData.get('awardId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  let poIds: string[];
  try {
    poIds = await createPurchaseOrdersFromAward(session.companyId, parsed.data.awardId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sipariş oluşturulamadı.') };
  }
  revalidatePath(`/dashboard/procurement/awards/${parsed.data.awardId}`);
  for (const id of poIds) revalidatePath(`/dashboard/procurement/purchase-orders/${id}`);
  return { success: `${poIds.length} sipariş oluşturuldu.` };
}

const PoIdSchema = z.object({ poId: z.string().trim().min(1) });

export async function issuePurchaseOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PoIdSchema.safeParse({ poId: formData.get('poId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await issuePurchaseOrder(session.companyId, parsed.data.poId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sipariş gönderilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  return { success: 'Sipariş tedarikçiye gönderildi olarak işaretlendi.' };
}

export async function acknowledgePurchaseOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PoIdSchema.safeParse({ poId: formData.get('poId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await acknowledgePurchaseOrder(session.companyId, parsed.data.poId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İşlem gerçekleştirilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  return { success: 'Tedarikçi onayı kaydedildi.' };
}

export async function cancelPurchaseOrderAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = PoIdSchema.safeParse({ poId: formData.get('poId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await cancelPurchaseOrder(session.companyId, parsed.data.poId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sipariş iptal edilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  return { success: 'Sipariş iptal edildi.' };
}

const AddPoAttachmentSchema = z.object({ poId: z.string().trim().min(1) });

export async function addPoAttachmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = AddPoAttachmentSchema.safeParse({ poId: formData.get('poId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Bir dosya seçin.' };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await addPoAttachment(session.companyId, parsed.data.poId, { fileName: file.name, mimeType: file.type || 'application/octet-stream', buffer, uploadedByUserId: session.id });
  } catch (err) {
    return { error: toErrorMessage(err, 'Dosya yüklenemedi.') };
  }
  revalidatePath(`/dashboard/procurement/purchase-orders/${parsed.data.poId}`);
  return { success: 'Dosya (sözleşme) eklendi.' };
}
