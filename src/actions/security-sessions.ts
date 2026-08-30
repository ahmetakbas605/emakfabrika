'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession, requireFactoryAdmin } from '@/lib/dal';
import { readSessionCookie } from '@/lib/session';
import { revokeSession, revokeOtherSessions } from '@/lib/security/sessions';
import { writeAuditLog } from '@/lib/security/audit';

export type FormState = { error?: string; success?: string } | undefined;

const RevokeSchema = z.object({ sessionId: z.string().trim().min(1) });

// madde 15 — kayıp cihaz senaryosu: kendi hesabındaki AYRI bir oturumu iptal et.
export async function revokeMySessionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RevokeSchema.safeParse({ sessionId: formData.get('sessionId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  await revokeSession(session.companyId, parsed.data.sessionId, session.id);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'LOGOUT', entity: 'USER_SESSION', entityId: parsed.data.sessionId, module: 'SECURITY', riskLevel: 'MEDIUM' });
  revalidatePath('/dashboard/security/sessions');
  return { success: 'Oturum sonlandırıldı.' };
}

export async function revokeAllOtherSessionsAction(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const pointer = await readSessionCookie();
  if (!pointer) return { error: 'Oturum bulunamadı.' };

  await revokeOtherSessions(session.companyId, session.id, pointer.sessionId, session.id);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'LOGOUT', entity: 'USER_SESSION', module: 'SECURITY', riskLevel: 'HIGH', changedFields: { scope: 'ALL_OTHER_SESSIONS' } });
  revalidatePath('/dashboard/security/sessions');
  return { success: 'Diğer tüm oturumlar sonlandırıldı.' };
}

const AdminRevokeSchema = z.object({ sessionId: z.string().trim().min(1), userId: z.string().trim().min(1) });

// Security Admin (madde 37) — bir çalışanın kaybolan cihazını admin uzaktan iptal edebilir.
export async function adminRevokeSessionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = AdminRevokeSchema.safeParse({ sessionId: formData.get('sessionId'), userId: formData.get('userId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  await revokeSession(session.companyId, parsed.data.sessionId, session.id);
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'LOGOUT', entity: 'USER_SESSION', entityId: parsed.data.sessionId, module: 'SECURITY', riskLevel: 'HIGH', changedFields: { targetUserId: parsed.data.userId, byAdmin: true } });
  revalidatePath('/dashboard/security');
  return { success: 'Oturum admin tarafından sonlandırıldı.' };
}
