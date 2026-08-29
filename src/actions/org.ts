'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireFactoryAdmin, requireSession } from '@/lib/dal';
import { createPosition, setUserOrgAssignment, createDelegation, deactivateDelegation } from '@/lib/org';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const PositionSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.'), title: z.string().trim().min(1, 'Unvan gerekli.'), approvalLevel: z.string().trim().optional() });

export async function createPositionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = PositionSchema.safeParse({ code: formData.get('code'), title: formData.get('title'), approvalLevel: optionalField(formData, 'approvalLevel') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createPosition(session.companyId, { code: parsed.data.code, title: parsed.data.title, approvalLevel: parsed.data.approvalLevel ? Number(parsed.data.approvalLevel) : undefined });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Pozisyon oluşturulamadı.' };
  }
  revalidatePath('/dashboard/org');
  return { success: 'Pozisyon oluşturuldu.' };
}

const OrgAssignmentSchema = z.object({ userId: z.string().trim().min(1), positionId: z.string().trim().optional(), managerUserId: z.string().trim().optional() });

export async function setUserOrgAssignmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = OrgAssignmentSchema.safeParse({ userId: formData.get('userId'), positionId: optionalField(formData, 'positionId'), managerUserId: optionalField(formData, 'managerUserId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setUserOrgAssignment(session.companyId, parsed.data.userId, parsed.data.positionId, parsed.data.managerUserId);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Atama kaydedilemedi.' };
  }
  revalidatePath('/dashboard/org');
  return { success: 'Atama güncellendi.' };
}

const DelegationSchema = z.object({ delegateUserId: z.string().trim().min(1, 'Vekil seçilmeli.'), startsAt: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'), endsAt: z.string().trim().min(1, 'Bitiş tarihi gerekli.') });

// Yalnızca KENDİ oturumundan vekalet verilebilir (self-service) — bir
// başkası adına vekalet atamak requireFactoryAdmin gerektirmez, bu
// bilinçli bir tasarım: "izne çıkacak kişi" en iyi bunu kendisi bilir.
export async function createDelegationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = DelegationSchema.safeParse({ delegateUserId: formData.get('delegateUserId'), startsAt: formData.get('startsAt'), endsAt: formData.get('endsAt') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createDelegation(session.companyId, { delegatorUserId: session.id, delegateUserId: parsed.data.delegateUserId, startsAt: new Date(parsed.data.startsAt), endsAt: new Date(parsed.data.endsAt) });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Vekalet oluşturulamadı.' };
  }
  revalidatePath('/dashboard/approvals/delegations');
  return { success: 'Vekalet oluşturuldu.' };
}

const DeactivateDelegationSchema = z.object({ delegationId: z.string().trim().min(1) });

export async function deactivateDelegationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = DeactivateDelegationSchema.safeParse({ delegationId: formData.get('delegationId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await deactivateDelegation(session.companyId, parsed.data.delegationId);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Vekalet kaldırılamadı.' };
  }
  revalidatePath('/dashboard/approvals/delegations');
  return { success: 'Vekalet kaldırıldı.' };
}
