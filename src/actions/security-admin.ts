'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireFactoryAdmin } from '@/lib/dal';
import { resolveSecurityEvent } from '@/lib/security/events';
import { createRetentionPolicy, createLegalHold, releaseLegalHold } from '@/lib/security/retention';
import { createDataSubjectRequest, submitDataSubjectRequest, resolveDataSubjectRequest } from '@/lib/security/dsr';
import { upsertInventoryEntry, deleteInventoryEntry } from '@/lib/security/classification';
import { createRoleConflictRule, deactivateRoleConflictRule } from '@/lib/security/sod';
import { requestBreakGlassAccess, approveBreakGlassAccess, revokeBreakGlassAccess } from '@/lib/security/breakglass';
import { writeAuditLog } from '@/lib/security/audit';
import { SecurityError } from '@/lib/security/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SecurityError ? err.message : fallback;
}

// --- Güvenlik Olayları ---
const ResolveEventSchema = z.object({ eventId: z.string().trim().min(1), status: z.enum(['RESOLVED', 'FALSE_POSITIVE']), note: z.string().trim().optional() });
export async function resolveSecurityEventAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ResolveEventSchema.safeParse({ eventId: formData.get('eventId'), status: formData.get('status'), note: optionalField(formData, 'note') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await resolveSecurityEvent(session.companyId, parsed.data.eventId, session.id, parsed.data.status, parsed.data.note);
  } catch (err) {
    return { error: toErrorMessage(err, 'İşlenemedi.') };
  }
  revalidatePath('/dashboard/security/events');
  return { success: 'Olay güncellendi.' };
}

// --- Saklama Politikası + Legal Hold ---
const CreatePolicySchema = z.object({ dataType: z.string().trim().min(1, 'Veri türü gerekli.'), legalBasis: z.string().trim().optional(), retentionYears: z.string().trim().min(1, 'Süre gerekli.'), startEvent: z.string().trim().optional(), deleteMethod: z.enum(['HARD_DELETE', 'ANONYMIZE', 'ARCHIVE']) });
export async function createRetentionPolicyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = CreatePolicySchema.safeParse({ dataType: formData.get('dataType'), legalBasis: optionalField(formData, 'legalBasis'), retentionYears: formData.get('retentionYears'), startEvent: optionalField(formData, 'startEvent'), deleteMethod: formData.get('deleteMethod') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  try {
    await createRetentionPolicy(session.companyId, { ...parsed.data, retentionYears: Number(parsed.data.retentionYears) });
    await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'RETENTION_POLICY_CHANGED', entity: 'RETENTION_POLICY', module: 'SECURITY', riskLevel: 'HIGH', newValue: parsed.data });
  } catch (err) {
    return { error: toErrorMessage(err, 'Kaydedilemedi.') };
  }
  revalidatePath('/dashboard/security/retention');
  return { success: 'Saklama politikası kaydedildi.' };
}

const CreateHoldSchema = z.object({ entityType: z.string().trim().min(1, 'Kayıt türü gerekli.'), entityId: z.string().trim().min(1, 'Kayıt ID gerekli.'), reason: z.string().trim().min(1, 'Gerekçe gerekli.') });
export async function createLegalHoldAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = CreateHoldSchema.safeParse({ entityType: formData.get('entityType'), entityId: formData.get('entityId'), reason: formData.get('reason') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createLegalHold(session.companyId, session.id, parsed.data);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'LEGAL_HOLD_CHANGED', entity: parsed.data.entityType, entityId: parsed.data.entityId, module: 'SECURITY', riskLevel: 'HIGH', newValue: { reason: parsed.data.reason } });
  revalidatePath('/dashboard/security/retention');
  return { success: 'Legal hold kaydedildi.' };
}

const ReleaseHoldSchema = z.object({ legalHoldId: z.string().trim().min(1) });
export async function releaseLegalHoldAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ReleaseHoldSchema.safeParse({ legalHoldId: formData.get('legalHoldId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await releaseLegalHold(session.companyId, parsed.data.legalHoldId);
    await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'LEGAL_HOLD_CHANGED', entity: 'LEGAL_HOLD', entityId: parsed.data.legalHoldId, module: 'SECURITY', riskLevel: 'HIGH', changedFields: { released: true } });
  } catch (err) {
    return { error: toErrorMessage(err, 'İşlenemedi.') };
  }
  revalidatePath('/dashboard/security/retention');
  return { success: 'Legal hold kaldırıldı.' };
}

// --- KVKK Veri Sahibi Talepleri ---
const CreateDsrSchema = z.object({ requestType: z.enum(['ACCESS', 'CORRECTION', 'DELETION', 'RESTRICTION', 'OBJECTION', 'PORTABILITY', 'OTHER']), subjectName: z.string().trim().min(1, 'Ad gerekli.'), subjectIdentifier: z.string().trim().optional(), description: z.string().trim().min(1, 'Açıklama gerekli.') });
export async function createDsrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = CreateDsrSchema.safeParse({ requestType: formData.get('requestType'), subjectName: formData.get('subjectName'), subjectIdentifier: optionalField(formData, 'subjectIdentifier'), description: formData.get('description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createDataSubjectRequest(session.companyId, session.id, parsed.data);
  revalidatePath('/dashboard/security/requests');
  return { success: 'KVKK talebi taslak olarak kaydedildi.' };
}

const SubmitDsrSchema = z.object({ requestId: z.string().trim().min(1) });
export async function submitDsrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = SubmitDsrSchema.safeParse({ requestId: formData.get('requestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await submitDataSubjectRequest(session.companyId, parsed.data.requestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath('/dashboard/security/requests');
  return { success: 'KVKK talebi onaya gönderildi.' };
}

const ResolveDsrSchema = z.object({ requestId: z.string().trim().min(1), note: z.string().trim().min(1, 'Sonuç notu gerekli.') });
export async function resolveDsrAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ResolveDsrSchema.safeParse({ requestId: formData.get('requestId'), note: formData.get('note') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  try {
    await resolveDataSubjectRequest(session.companyId, parsed.data.requestId, parsed.data.note);
  } catch (err) {
    return { error: toErrorMessage(err, 'İşlenemedi.') };
  }
  revalidatePath('/dashboard/security/requests');
  return { success: 'KVKK talebi tamamlandı olarak işaretlendi.' };
}

// --- Veri Sınıflandırma Envanteri ---
const UpsertInventorySchema = z.object({ tableName: z.string().trim().min(1, 'Tablo adı gerekli.'), columnName: z.string().trim().min(1, 'Kolon adı gerekli.'), dataCategory: z.string().trim().optional(), classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PERSONAL', 'SPECIAL_CATEGORY', 'FINANCIAL', 'HIGHLY_CONFIDENTIAL', 'SYSTEM_SECURITY']), purpose: z.string().trim().optional(), legalBasis: z.string().trim().optional(), encryptionRequired: z.string().trim().optional(), maskingRequired: z.string().trim().optional(), exportAllowed: z.string().trim().optional() });
export async function upsertInventoryEntryAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = UpsertInventorySchema.safeParse({
    tableName: formData.get('tableName'), columnName: formData.get('columnName'), dataCategory: optionalField(formData, 'dataCategory'), classification: formData.get('classification'),
    purpose: optionalField(formData, 'purpose'), legalBasis: optionalField(formData, 'legalBasis'), encryptionRequired: optionalField(formData, 'encryptionRequired'), maskingRequired: optionalField(formData, 'maskingRequired'), exportAllowed: optionalField(formData, 'exportAllowed')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await upsertInventoryEntry(session.companyId, { ...parsed.data, encryptionRequired: parsed.data.encryptionRequired === 'on', maskingRequired: parsed.data.maskingRequired === 'on', exportAllowed: parsed.data.exportAllowed !== 'off' });
  revalidatePath('/dashboard/security/classification');
  return { success: 'Envanter kaydı kaydedildi.' };
}

const DeleteInventorySchema = z.object({ entryId: z.string().trim().min(1) });
export async function deleteInventoryEntryAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = DeleteInventorySchema.safeParse({ entryId: formData.get('entryId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await deleteInventoryEntry(session.companyId, parsed.data.entryId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Silinemedi.') };
  }
  revalidatePath('/dashboard/security/classification');
  return { success: 'Envanter kaydı silindi.' };
}

// --- Segregation of Duties ---
const CreateSodSchema = z.object({ documentType: z.string().trim().min(1, 'Belge türü gerekli.'), rule: z.enum(['CREATOR_CANNOT_APPROVE']), description: z.string().trim().optional() });
export async function createRoleConflictRuleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = CreateSodSchema.safeParse({ documentType: formData.get('documentType'), rule: formData.get('rule'), description: optionalField(formData, 'description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createRoleConflictRule(session.companyId, parsed.data.documentType, parsed.data.rule, parsed.data.description);
  revalidatePath('/dashboard/security/sod');
  return { success: 'Kural kaydedildi.' };
}

const DeactivateSodSchema = z.object({ ruleId: z.string().trim().min(1) });
export async function deactivateRoleConflictRuleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = DeactivateSodSchema.safeParse({ ruleId: formData.get('ruleId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  await deactivateRoleConflictRule(session.companyId, parsed.data.ruleId);
  revalidatePath('/dashboard/security/sod');
  return { success: 'Kural devre dışı bırakıldı.' };
}

// --- Break-Glass ---
const RequestBreakGlassSchema = z.object({ reason: z.string().trim().min(1, 'Gerekçe gerekli.'), ticketReference: z.string().trim().optional(), scope: z.string().trim().optional() });
export async function requestBreakGlassAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = RequestBreakGlassSchema.safeParse({ reason: formData.get('reason'), ticketReference: optionalField(formData, 'ticketReference'), scope: optionalField(formData, 'scope') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await requestBreakGlassAccess(session.companyId, session.id, parsed.data);
  revalidatePath('/dashboard/security/break-glass');
  return { success: 'Break-glass talebi kaydedildi.' };
}

const ApproveBreakGlassSchema = z.object({ accessId: z.string().trim().min(1), durationHours: z.string().trim().min(1, 'Süre gerekli.') });
export async function approveBreakGlassAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = ApproveBreakGlassSchema.safeParse({ accessId: formData.get('accessId'), durationHours: formData.get('durationHours') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  try {
    await approveBreakGlassAccess(session.companyId, parsed.data.accessId, session.id, Number(parsed.data.durationHours));
  } catch (err) {
    return { error: toErrorMessage(err, 'Onaylanamadı.') };
  }
  revalidatePath('/dashboard/security/break-glass');
  return { success: 'Erişim onaylandı.' };
}

const RevokeBreakGlassSchema = z.object({ accessId: z.string().trim().min(1) });
export async function revokeBreakGlassAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = RevokeBreakGlassSchema.safeParse({ accessId: formData.get('accessId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };
  try {
    await revokeBreakGlassAccess(session.companyId, parsed.data.accessId);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/security/break-glass');
  return { success: 'Erişim iptal edildi.' };
}
