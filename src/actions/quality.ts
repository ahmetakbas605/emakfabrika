'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { recordInspection } from '@/lib/quality/inspections';
import { createNcr, startNcrInvestigation, recordNcrRootCause, recordNcrActions, closeNcr, rejectNcr } from '@/lib/quality/ncr';
import { QualityError } from '@/lib/quality/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof QualityError ? err.message : fallback;
}

const RecordInspectionSchema = z.object({
  type: z.enum(['INCOMING', 'IN_PROCESS', 'FINAL']),
  sourceType: z.string().trim().min(1),
  sourceId: z.string().trim().min(1, 'Muayene edilecek kayıt seçilmeli.'),
  productId: z.string().trim().optional(),
  inspectedQty: z.coerce.number().positive('Muayene edilen miktar pozitif olmalı.'),
  passedQty: z.coerce.number().min(0),
  failedQty: z.coerce.number().min(0),
  result: z.enum(['PASS', 'FAIL', 'CONDITIONAL']),
  notes: z.string().trim().optional()
});

export async function recordInspectionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordInspectionSchema.safeParse({
    type: formData.get('type'), sourceType: formData.get('sourceType'), sourceId: formData.get('sourceId'), productId: optionalField(formData, 'productId'),
    inspectedQty: formData.get('inspectedQty'), passedQty: formData.get('passedQty'), failedQty: formData.get('failedQty'),
    result: formData.get('result'), notes: optionalField(formData, 'notes')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordInspection(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Muayene kaydedilemedi.') };
  }
  revalidatePath('/dashboard/quality');
  return { success: 'Muayene kaydedildi.' };
}

const CreateNcrSchema = z.object({
  inspectionId: z.string().trim().optional(),
  supplierPartyId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  description: z.string().trim().min(1, 'Açıklama gerekli.'),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).optional(),
  assignedToUserId: z.string().trim().optional()
});

export async function createNcrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateNcrSchema.safeParse({
    inspectionId: optionalField(formData, 'inspectionId'), supplierPartyId: optionalField(formData, 'supplierPartyId'), productId: optionalField(formData, 'productId'),
    title: formData.get('title'), description: formData.get('description'), severity: optionalField(formData, 'severity'), assignedToUserId: optionalField(formData, 'assignedToUserId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createNcr(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'NCR oluşturulamadı.') };
  }
  revalidatePath('/dashboard/quality');
  return { success: 'NCR oluşturuldu.' };
}

const NcrIdSchema = z.object({ ncrId: z.string().trim().min(1) });

export async function startNcrInvestigationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = NcrIdSchema.safeParse({ ncrId: formData.get('ncrId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await startNcrInvestigation(session.companyId, parsed.data.ncrId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Soruşturma başlatılamadı.') };
  }
  revalidatePath(`/dashboard/quality/ncr/${parsed.data.ncrId}`);
  revalidatePath('/dashboard/quality');
  return { success: 'Soruşturma başlatıldı.' };
}

const RecordNcrRootCauseSchema = z.object({ ncrId: z.string().trim().min(1), rootCause: z.string().trim().min(1, 'Kök neden gerekli.') });

export async function recordNcrRootCauseAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordNcrRootCauseSchema.safeParse({ ncrId: formData.get('ncrId'), rootCause: formData.get('rootCause') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordNcrRootCause(session.companyId, parsed.data.ncrId, parsed.data.rootCause);
  } catch (err) {
    return { error: toErrorMessage(err, 'Kök neden kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/quality/ncr/${parsed.data.ncrId}`);
  return { success: 'Kök neden kaydedildi.' };
}

const RecordNcrActionsSchema = z.object({
  ncrId: z.string().trim().min(1),
  correctiveAction: z.string().trim().min(1, 'Düzeltici faaliyet gerekli.'),
  preventiveAction: z.string().trim().min(1, 'Önleyici faaliyet gerekli.')
});

export async function recordNcrActionsAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordNcrActionsSchema.safeParse({ ncrId: formData.get('ncrId'), correctiveAction: formData.get('correctiveAction'), preventiveAction: formData.get('preventiveAction') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordNcrActions(session.companyId, parsed.data.ncrId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Düzeltici/önleyici faaliyet kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/quality/ncr/${parsed.data.ncrId}`);
  return { success: 'Düzeltici/önleyici faaliyet kaydedildi.' };
}

export async function closeNcrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = NcrIdSchema.safeParse({ ncrId: formData.get('ncrId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await closeNcr(session.companyId, parsed.data.ncrId);
  } catch (err) {
    return { error: toErrorMessage(err, 'NCR kapatılamadı.') };
  }
  revalidatePath(`/dashboard/quality/ncr/${parsed.data.ncrId}`);
  revalidatePath('/dashboard/quality');
  return { success: 'NCR kapatıldı.' };
}

export async function rejectNcrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = NcrIdSchema.safeParse({ ncrId: formData.get('ncrId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await rejectNcr(session.companyId, parsed.data.ncrId);
  } catch (err) {
    return { error: toErrorMessage(err, 'NCR reddedilemedi.') };
  }
  revalidatePath(`/dashboard/quality/ncr/${parsed.data.ncrId}`);
  revalidatePath('/dashboard/quality');
  return { success: 'NCR reddedildi.' };
}
