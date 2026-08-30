'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createAccessZone, createAccessGroup, addZoneToGroup, addGroupMember, issueCard, setCardStatus, recordAccessAttempt } from '@/lib/hr/access';
import { HrError } from '@/lib/hr/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof HrError ? err.message : fallback;
}

const CreateZoneSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), description: z.string().trim().optional() });

export async function createAccessZoneAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateZoneSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), description: optionalField(formData, 'description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createAccessZone(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Bölge kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Erişim bölgesi kaydedildi.' };
}

const CreateGroupSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'), description: z.string().trim().optional() });

export async function createAccessGroupAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = CreateGroupSchema.safeParse({ code: formData.get('code'), name: formData.get('name'), description: optionalField(formData, 'description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createAccessGroup(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Grup kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Erişim grubu kaydedildi.' };
}

const AddZoneToGroupSchema = z.object({ groupId: z.string().trim().min(1, 'Grup seçilmeli.'), zoneId: z.string().trim().min(1, 'Bölge seçilmeli.') });

export async function addZoneToGroupAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = AddZoneToGroupSchema.safeParse({ groupId: formData.get('groupId'), zoneId: formData.get('zoneId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addZoneToGroup(session.companyId, parsed.data.groupId, parsed.data.zoneId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Eklenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Bölge gruba eklendi.' };
}

const AddGroupMemberSchema = z.object({
  groupId: z.string().trim().min(1, 'Grup seçilmeli.'), employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'),
  validFrom: z.string().trim().optional(), validUntil: z.string().trim().optional()
});

export async function addGroupMemberAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = AddGroupMemberSchema.safeParse({
    groupId: formData.get('groupId'), employeeId: formData.get('employeeId'), validFrom: optionalField(formData, 'validFrom'), validUntil: optionalField(formData, 'validUntil')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addGroupMember(session.companyId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Eklenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Çalışan gruba eklendi.' };
}

const IssueCardSchema = z.object({ employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'), cardNumber: z.string().trim().min(1, 'Kart numarası gerekli.') });

export async function issueCardAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = IssueCardSchema.safeParse({ employeeId: formData.get('employeeId'), cardNumber: formData.get('cardNumber') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await issueCard(session.companyId, parsed.data.employeeId, parsed.data.cardNumber);
  } catch (err) {
    return { error: toErrorMessage(err, 'Kart kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Kart tanımlandı.' };
}

const SetCardStatusSchema = z.object({ cardId: z.string().trim().min(1), status: z.enum(['ACTIVE', 'LOST', 'REVOKED', 'EXPIRED']) });

export async function setCardStatusAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = SetCardStatusSchema.safeParse({ cardId: formData.get('cardId'), status: formData.get('status') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await setCardStatus(session.companyId, parsed.data.cardId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Güncellenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
  return { success: 'Kart durumu güncellendi.' };
}

const RecordAccessSchema = z.object({
  deviceId: z.string().trim().min(1, 'Cihaz seçilmeli.'), zoneId: z.string().trim().min(1, 'Bölge seçilmeli.'), cardNumber: z.string().trim().min(1, 'Kart numarası gerekli.')
});

export async function recordAccessAttemptAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = RecordAccessSchema.safeParse({ deviceId: formData.get('deviceId'), zoneId: formData.get('zoneId'), cardNumber: formData.get('cardNumber') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const result = await recordAccessAttempt(session.companyId, session.id, parsed.data);
    revalidatePath(`/dashboard/departments/${departmentId}/hr/access`);
    return result.result === 'GRANTED' ? { success: 'Erişim İZİN VERİLDİ.' } : { error: `Erişim REDDEDİLDİ (${result.reason}).` };
  } catch (err) {
    return { error: toErrorMessage(err, 'Kayıt eklenemedi.') };
  }
}
