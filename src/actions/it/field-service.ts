'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  createWorkOrder, markArrived, recordSignature, createChecklistTemplate, attachChecklistToWorkOrder,
  toggleChecklistItem, consumePart, setContinuousLocationTracking
} from '@/lib/it/field-service';
import { ItError } from '@/lib/it/errors';
import { AccountingError } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateWorkOrderSchema = z.object({ ticketId: z.string().trim().min(1, 'Ticket seçilmeli.') });

export async function createWorkOrderAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateWorkOrderSchema.safeParse({ ticketId: formData.get('ticketId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWorkOrder(session.companyId, parsed.data.ticketId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Work order oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service`);
  return { success: 'Work order oluşturuldu.' };
}

const MarkArrivedSchema = z.object({ workOrderId: z.string().trim().min(1), latitude: z.string().trim().min(1, 'Konum gerekli.'), longitude: z.string().trim().min(1, 'Konum gerekli.') });

export async function markArrivedAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = MarkArrivedSchema.safeParse({ workOrderId: formData.get('workOrderId'), latitude: formData.get('latitude'), longitude: formData.get('longitude') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await markArrived(session.companyId, parsed.data.workOrderId, session.id, Number(parsed.data.latitude), Number(parsed.data.longitude));
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Varış kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service/${parsed.data.workOrderId}`);
  return { success: 'Varış kaydedildi.' };
}

const SignatureSchema = z.object({ workOrderId: z.string().trim().min(1), customerName: z.string().trim().min(1, 'Müşteri adı gerekli.'), signatureNote: z.string().trim().min(1, 'Onay notu gerekli.') });

export async function recordSignatureAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = SignatureSchema.safeParse({ workOrderId: formData.get('workOrderId'), customerName: formData.get('customerName'), signatureNote: formData.get('signatureNote') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordSignature(session.companyId, parsed.data.workOrderId, parsed.data.customerName, parsed.data.signatureNote);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Onay kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service/${parsed.data.workOrderId}`);
  return { success: 'Müşteri onayı kaydedildi.' };
}

const ChecklistTemplateSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), itemsText: z.string().trim().min(1, 'En az bir madde girin.') });

export async function createChecklistTemplateAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = ChecklistTemplateSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), itemsText: formData.get('itemsText') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const items = parsed.data.itemsText.split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    await createChecklistTemplate(session.companyId, { code: parsed.data.code, name: parsed.data.name, items });
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Şablon oluşturulamadı — bu kod zaten kullanılıyor olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service`);
  return { success: 'Checklist şablonu oluşturuldu.' };
}

const AttachChecklistSchema = z.object({ workOrderId: z.string().trim().min(1), templateId: z.string().trim().optional() });

export async function attachChecklistAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'update');
  const parsed = AttachChecklistSchema.safeParse({ workOrderId: formData.get('workOrderId'), templateId: optionalField(formData, 'templateId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await attachChecklistToWorkOrder(parsed.data.workOrderId, parsed.data.templateId ?? null);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Checklist eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service/${parsed.data.workOrderId}`);
  return { success: 'Checklist eklendi.' };
}

const ToggleChecklistItemSchema = z.object({ itemId: z.string().trim().min(1), workOrderId: z.string().trim().min(1), checked: z.string().trim().optional(), note: z.string().trim().optional() });

export async function toggleChecklistItemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ToggleChecklistItemSchema.safeParse({ itemId: formData.get('itemId'), workOrderId: formData.get('workOrderId'), checked: optionalField(formData, 'checked'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await toggleChecklistItem(session.companyId, parsed.data.itemId, parsed.data.checked === 'on', session.id, parsed.data.note);
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service/${parsed.data.workOrderId}`);
  return { success: 'Güncellendi.' };
}

const ConsumePartSchema = z.object({ workOrderId: z.string().trim().min(1), warehouseId: z.string().trim().min(1, 'Depo seçilmeli.'), stockItemId: z.string().trim().min(1, 'Malzeme seçilmeli.'), quantity: z.string().trim().min(1, 'Miktar gerekli.'), billable: z.string().trim().optional() });

export async function consumePartAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ConsumePartSchema.safeParse({
    workOrderId: formData.get('workOrderId'), warehouseId: formData.get('warehouseId'), stockItemId: formData.get('stockItemId'),
    quantity: formData.get('quantity'), billable: optionalField(formData, 'billable')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await consumePart(session.companyId, {
      workOrderId: parsed.data.workOrderId, warehouseId: parsed.data.warehouseId, stockItemId: parsed.data.stockItemId,
      quantity: parsed.data.quantity, billable: parsed.data.billable === 'on', consumedByUserId: session.id
    });
  } catch (err) {
    return { error: err instanceof ItError || err instanceof AccountingError ? err.message : 'Malzeme tüketimi kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service/${parsed.data.workOrderId}`);
  return { success: 'Malzeme tüketimi kaydedildi, stoktan düşüldü.' };
}

const PolicySchema = z.object({ enabled: z.string().trim().optional() });

export async function setContinuousLocationTrackingAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = PolicySchema.safeParse({ enabled: optionalField(formData, 'enabled') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  await setContinuousLocationTracking(session.companyId, parsed.data.enabled === 'on');
  revalidatePath(`/dashboard/departments/${departmentId}/it/field-service`);
  return { success: 'Politika güncellendi.' };
}
