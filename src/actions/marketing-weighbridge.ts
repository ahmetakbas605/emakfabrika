'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  cancelWeighbridgeTicket,
  createWeighbridge,
  createWeighbridgeTicket,
  reverseWeighbridgeTicket
} from '@/lib/marketing/weighbridge';
import { MarketingError } from '@/lib/marketing/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const WeighbridgeSchema = z.object({
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  location: z.string().trim().optional(),
  capacityKg: z.string().trim().optional(),
  roadLegalLimitKg: z.string().trim().optional(),
  tolerancePercent: z.string().trim().optional()
});

export async function createWeighbridgeAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = WeighbridgeSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    location: optionalField(formData, 'location'),
    capacityKg: optionalField(formData, 'capacityKg'),
    roadLegalLimitKg: optionalField(formData, 'roadLegalLimitKg'),
    tolerancePercent: optionalField(formData, 'tolerancePercent')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWeighbridge(session.companyId, { departmentId, ...parsed.data });
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Kantar eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/weighbridge`);
  return { success: 'Kantar tanımlandı.' };
}

const TicketSchema = z.object({
  weighbridgeId: z.string().trim().min(1, 'Kantar seçin.'),
  purpose: z.enum(['SALES_QUANTITY', 'ROAD_LEGAL_CHECK']),
  direction: z.enum(['OUTBOUND', 'INBOUND']).optional(),
  plateNo: z.string().trim().min(1, 'Plaka gerekli.'),
  driverName: z.string().trim().optional(),
  carrierName: z.string().trim().optional(),
  partyId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  orderLineId: z.string().trim().optional(),
  grossKg: z.string().trim().optional(),
  tareKg: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export async function createWeighbridgeTicketAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = TicketSchema.safeParse({
    weighbridgeId: formData.get('weighbridgeId'),
    purpose: formData.get('purpose'),
    direction: optionalField(formData, 'direction'),
    plateNo: formData.get('plateNo'),
    driverName: optionalField(formData, 'driverName'),
    carrierName: optionalField(formData, 'carrierName'),
    partyId: optionalField(formData, 'partyId'),
    productId: optionalField(formData, 'productId'),
    orderLineId: optionalField(formData, 'orderLineId'),
    grossKg: optionalField(formData, 'grossKg'),
    tareKg: optionalField(formData, 'tareKg'),
    notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWeighbridgeTicket(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Tartım fişi oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/weighbridge`);
  return { success: 'Tartım fişi kaydedildi.' };
}

// İptal — 'cancel' yetkisi. Fiş SİLİNMEZ, durumu değişir.
export async function cancelWeighbridgeTicketAction(
  departmentId: string,
  ticketId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'cancel');

  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { error: 'İptal sebebi zorunludur.' };

  try {
    await cancelWeighbridgeTicket(session.companyId, ticketId, reason);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'İptal edilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/weighbridge`);
  return { success: 'Fiş iptal edildi.' };
}

// Ters kayıt — 'correct_weighing' yetkisi. Kullanıcının açık isteği
// gereği bu, 'update'ten ve 'cancel'dan AYRI bir yetki: faturaya giden
// miktarı değiştirdiği için kantar operatöründe YOK, müdürde var.
export async function reverseWeighbridgeTicketAction(
  departmentId: string,
  ticketId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session, access } = await requireDepartmentAccess(departmentId, 'view');
  if (!access.permissions.correct_weighing) {
    return { error: 'Ters kayıt için tartım düzeltme yetkisi gerekir.' };
  }

  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { error: 'Ters kayıt sebebi zorunludur.' };

  try {
    await reverseWeighbridgeTicket(session.companyId, session.id, ticketId, reason);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Ters kayıt yapılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/weighbridge`);
  return { success: 'Ters kayıt oluşturuldu.' };
}
