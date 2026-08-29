'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createProcRequest, submitProcRequest, cancelProcRequest, updateLineStockStatus, addProcRequestLineAttachment, type CreateProcRequestLineInput, type CreateProcRequestInput } from '@/lib/procurement/requisition';
import { ProcurementError } from '@/lib/procurement/errors';
import { AccountingError } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ProcurementError || err instanceof AccountingError) return err.message;
  return fallback;
}

const RequestLineSchema = z.object({
  productId: z.string().trim().optional(),
  stockItemId: z.string().trim().optional(),
  description: z.string().trim().min(1),
  quantity: z.string().trim().min(1),
  unitId: z.string().trim().min(1),
  preferredBrand: z.string().trim().optional(),
  alternativeBrand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  estimatedUnitPrice: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  deliveryLocation: z.string().trim().optional(),
  technicalSpec: z.string().trim().optional()
});

const CreateProcRequestSchema = z.object({
  departmentId: z.string().trim().optional(),
  requestType: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  costCenterId: z.string().trim().optional(),
  budgetItemId: z.string().trim().optional(),
  capexOpex: z.enum(['CAPEX', 'OPEX']).optional(),
  requestedDeliveryDate: z.string().trim().optional(),
  justification: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  lines: z.array(RequestLineSchema).min(1, 'En az bir kalem gerekli.')
});

// StockTransferForm İLE AYNI desen — dinamik satır listesi client'ta
// biriktirilir, tek bir gizli input'a JSON.stringify edilerek gönderilir.
export async function createProcRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz satır verisi.' };
  }
  const parsed = CreateProcRequestSchema.safeParse({
    departmentId: optionalField(formData, 'departmentId'),
    requestType: optionalField(formData, 'requestType'),
    priority: optionalField(formData, 'priority'),
    costCenterId: optionalField(formData, 'costCenterId'),
    budgetItemId: optionalField(formData, 'budgetItemId'),
    capexOpex: optionalField(formData, 'capexOpex'),
    requestedDeliveryDate: optionalField(formData, 'requestedDeliveryDate'),
    justification: optionalField(formData, 'justification'),
    currencyCode: optionalField(formData, 'currencyCode'),
    lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const lines: CreateProcRequestLineInput[] = parsed.data.lines.map((l) => ({
      productId: l.productId || undefined,
      stockItemId: l.stockItemId || undefined,
      description: l.description,
      quantity: l.quantity,
      unitId: l.unitId,
      preferredBrand: l.preferredBrand,
      alternativeBrand: l.alternativeBrand,
      model: l.model,
      estimatedUnitPrice: l.estimatedUnitPrice || undefined,
      warehouseId: l.warehouseId || undefined,
      deliveryLocation: l.deliveryLocation,
      technicalSpec: l.technicalSpec ? { description: l.technicalSpec } : undefined
    }));
    await createProcRequest(session.companyId, session.id, {
      departmentId: parsed.data.departmentId,
      requestType: parsed.data.requestType as CreateProcRequestInput['requestType'],
      priority: parsed.data.priority as CreateProcRequestInput['priority'],
      costCenterId: parsed.data.costCenterId,
      budgetItemId: parsed.data.budgetItemId,
      capexOpex: parsed.data.capexOpex,
      requestedDeliveryDate: parsed.data.requestedDeliveryDate,
      justification: parsed.data.justification,
      currencyCode: parsed.data.currencyCode,
      lines
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Talep oluşturulamadı.') };
  }
  revalidatePath('/dashboard/procurement');
  return { success: 'Talep oluşturuldu.' };
}

const SubmitSchema = z.object({ requestId: z.string().trim().min(1) });

export async function submitProcRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitSchema.safeParse({ requestId: formData.get('requestId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await submitProcRequest(session.companyId, parsed.data.requestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Talep gönderilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/${parsed.data.requestId}`);
  return { success: 'Talep onaya gönderildi.' };
}

export async function cancelProcRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitSchema.safeParse({ requestId: formData.get('requestId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await cancelProcRequest(session.companyId, parsed.data.requestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Talep iptal edilemedi.') };
  }
  revalidatePath(`/dashboard/procurement/${parsed.data.requestId}`);
  return { success: 'Talep iptal edildi.' };
}

const UpdateStockStatusSchema = z.object({ lineId: z.string().trim().min(1), stockStatus: z.enum(['PENDING', 'STOCK_AVAILABLE', 'STOCK_PARTIAL', 'STOCK_UNAVAILABLE', 'NEW_PURCHASE_REQUIRED']), requestId: z.string().trim().min(1) });

export async function updateLineStockStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = UpdateStockStatusSchema.safeParse({ lineId: formData.get('lineId'), stockStatus: formData.get('stockStatus'), requestId: formData.get('requestId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await updateLineStockStatus(session.companyId, parsed.data.lineId, parsed.data.stockStatus);
  } catch (err) {
    return { error: toErrorMessage(err, 'Durum güncellenemedi.') };
  }
  revalidatePath(`/dashboard/procurement/${parsed.data.requestId}`);
  return { success: 'Stok durumu güncellendi.' };
}

const AttachmentSchema = z.object({ lineId: z.string().trim().min(1), requestId: z.string().trim().min(1) });

export async function addProcRequestLineAttachmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = AttachmentSchema.safeParse({ lineId: formData.get('lineId'), requestId: formData.get('requestId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Dosya seçilmeli.' };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await addProcRequestLineAttachment(session.companyId, parsed.data.lineId, { fileName: file.name, mimeType: file.type || 'application/octet-stream', buffer, uploadedByUserId: session.id });
  } catch (err) {
    return { error: toErrorMessage(err, 'Dosya yüklenemedi.') };
  }
  revalidatePath(`/dashboard/procurement/${parsed.data.requestId}`);
  return { success: 'Dosya eklendi.' };
}
