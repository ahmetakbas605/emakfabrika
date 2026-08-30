'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession, requireFactoryAdmin } from '@/lib/dal';
import { beginMfaSetup, confirmMfaSetup, disableMfa } from '@/lib/security/mfa';
import { writeAuditLog } from '@/lib/security/audit';
import { SecurityError } from '@/lib/security/errors';

export type FormState = { error?: string; success?: string; qrCodeDataUrl?: string; secret?: string; recoveryCodes?: string[] } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SecurityError ? err.message : fallback;
}

// Kendi kendine hizmet — herkes KENDİ MFA'sını kurar (madde 14).
export async function beginMfaSetupAction(): Promise<FormState> {
  const session = await requireSession();
  const result = await beginMfaSetup(session.companyId, session.id, session.email);
  return { success: 'Kurulum başlatıldı — QR kodu tarayın ve doğrulama kodunu girin.', qrCodeDataUrl: result.qrCodeDataUrl, secret: result.secret, recoveryCodes: result.recoveryCodes };
}

const ConfirmSchema = z.object({ code: z.string().trim().min(1, 'Kod gerekli.') });

export async function confirmMfaSetupAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ConfirmSchema.safeParse({ code: formData.get('code') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await confirmMfaSetup(session.id, parsed.data.code);
    await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'MFA_CHANGED', entity: 'USER', entityId: session.id, module: 'SECURITY', riskLevel: 'HIGH', changedFields: { mfaEnabled: true } });
  } catch (err) {
    return { error: toErrorMessage(err, 'Doğrulama başarısız.') };
  }
  revalidatePath('/dashboard/security/mfa');
  return { success: 'MFA etkinleştirildi.' };
}

export async function disableMfaAction(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const session = await requireSession();
  await disableMfa(session.id);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'MFA_CHANGED', entity: 'USER', entityId: session.id, module: 'SECURITY', riskLevel: 'HIGH', changedFields: { mfaEnabled: false } });
  revalidatePath('/dashboard/security/mfa');
  return { success: 'MFA devre dışı bırakıldı.' };
}

const AdminDisableSchema = z.object({ userId: z.string().trim().min(1) });

// Security Admin (madde 37) — bir kullanıcının cihazı kaybolduysa/MFA'sı
// kilitlendiyse admin MFA'yı sıfırlayabilir.
export async function adminDisableMfaAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = AdminDisableSchema.safeParse({ userId: formData.get('userId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  await disableMfa(parsed.data.userId);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'MFA_CHANGED', entity: 'USER', entityId: parsed.data.userId, module: 'SECURITY', riskLevel: 'CRITICAL', changedFields: { mfaEnabled: false, byAdmin: true } });
  revalidatePath('/dashboard/security');
  return { success: 'Kullanıcının MFA\'sı sıfırlandı.' };
}
