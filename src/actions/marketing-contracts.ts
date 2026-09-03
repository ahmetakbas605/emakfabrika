'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  addContractLine,
  createContract,
  createOrderFromContract,
  transitionContract
} from '@/lib/marketing/contracts';
import { MarketingError } from '@/lib/marketing/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const DELIVERY_TERMS = ['EX_WORKS', 'DELIVERED', 'FOB', 'CIF', 'OTHER'] as const;

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Sözleşme başlığı gerekli.'),
  partyId: z.string().trim().min(1, 'Cari seçin.'),
  currencyCode: z.string().trim().min(1, 'Para birimi seçin.'),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  counterpartySignatory: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  productId: z.string().trim().min(1, 'Ürün seçin.'),
  quantity: z.string().trim().min(1, 'Miktar gerekli.'),
  unitPrice: z.string().trim().min(1, 'Birim fiyat gerekli.'),
  deliveryTerm: z.enum(DELIVERY_TERMS).optional(),
  deliveryNote: z.string().trim().optional()
});

// Sözleşme ilk kalemiyle birlikte açılır — kalemsiz bir sözleşme
// kaydetmek, sonra "en az bir kalem olmalı" diye reddetmekten iyi.
export async function createContractAction(
  departmentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateSchema.safeParse({
    title: formData.get('title'),
    partyId: formData.get('partyId'),
    currencyCode: formData.get('currencyCode'),
    startDate: optionalField(formData, 'startDate'),
    endDate: optionalField(formData, 'endDate'),
    counterpartySignatory: optionalField(formData, 'counterpartySignatory'),
    notes: optionalField(formData, 'notes'),
    productId: formData.get('productId'),
    quantity: formData.get('quantity'),
    unitPrice: formData.get('unitPrice'),
    deliveryTerm: optionalField(formData, 'deliveryTerm'),
    deliveryNote: optionalField(formData, 'deliveryNote')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const d = parsed.data;
  try {
    await createContract(session.companyId, session.id, {
      departmentId,
      title: d.title,
      partyId: d.partyId,
      currencyCode: d.currencyCode,
      startDate: d.startDate,
      endDate: d.endDate,
      counterpartyIsContractor: formData.get('counterpartyIsContractor') === 'on',
      counterpartySignatory: d.counterpartySignatory,
      notes: d.notes,
      lines: [
        {
          productId: d.productId,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          deliveryTerm: d.deliveryTerm,
          deliveryNote: d.deliveryNote
        }
      ]
    });
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Sözleşme oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/contracts`);
  return { success: 'Sözleşme taslağı oluşturuldu.' };
}

const LineSchema = z.object({
  productId: z.string().trim().min(1, 'Ürün seçin.'),
  quantity: z.string().trim().min(1, 'Miktar gerekli.'),
  unitPrice: z.string().trim().min(1, 'Birim fiyat gerekli.'),
  deliveryTerm: z.enum(DELIVERY_TERMS).optional(),
  deliveryNote: z.string().trim().optional()
});

export async function addContractLineAction(
  departmentId: string,
  contractId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = LineSchema.safeParse({
    productId: formData.get('productId'),
    quantity: formData.get('quantity'),
    unitPrice: formData.get('unitPrice'),
    deliveryTerm: optionalField(formData, 'deliveryTerm'),
    deliveryNote: optionalField(formData, 'deliveryNote')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addContractLine(session.companyId, contractId, parsed.data);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Kalem eklenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/contracts`);
  return { success: 'Kalem eklendi.' };
}

// İMZA 'approve' yetkisine bağlı, 'update'e değil: sözleşmeyi hazırlayan
// ile imza altına alan aynı kişi olmak ZORUNDA değil. Satış personelinde
// approve YOK (bkz. migrate.ts MARKETING_ROLE_PERMISSIONS).
const SIGN_ACTIONS = ['SIGN', 'ACTIVATE', 'TERMINATE'] as const;

export async function transitionContractAction(
  departmentId: string,
  contractId: string,
  action: 'SUBMIT' | 'SIGN' | 'ACTIVATE' | 'EXPIRE' | 'TERMINATE' | 'BACK_TO_DRAFT',
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const needsApproval = (SIGN_ACTIONS as readonly string[]).includes(action);
  const { session } = await requireDepartmentAccess(departmentId, needsApproval ? 'approve' : 'update');

  try {
    await transitionContract(session.companyId, contractId, {
      action,
      userId: session.id,
      counterpartySignatory: optionalField(formData, 'counterpartySignatory'),
      terminationReason: optionalField(formData, 'terminationReason')
    });
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'İşlem yapılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/contracts`);
  return { success: 'Sözleşme durumu güncellendi.' };
}

export async function createOrderFromContractAction(
  departmentId: string,
  contractId: string,
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  try {
    await createOrderFromContract(session.companyId, session.id, contractId);
  } catch (err) {
    return { error: err instanceof MarketingError ? err.message : 'Sipariş oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/marketing/contracts`);
  return { success: 'Sözleşmeden sipariş oluşturuldu.' };
}
