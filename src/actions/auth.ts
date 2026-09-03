'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '@/lib/auth';
import { setSessionCookie, readSessionCookie, clearSessionCookie, signMfaPendingToken, verifyMfaPendingToken } from '@/lib/session';
import { createUserSession, revokeSession } from '@/lib/security/sessions';
import { verifyMfaCode } from '@/lib/security/mfa';
import { writeAuditLog } from '@/lib/security/audit';

export type FormState = { error?: string; mfaRequired?: boolean; mfaPendingToken?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta girin.'),
  password: z.string().min(1, 'Şifre gerekli.')
});

const FAILED_LOGIN_LIMIT = 5;
// Güvenlik denetimi 2026-09-03, bulgu 2.5 — eskiden bu eşiğe ulaşınca
// `active: false` KALICI oluyordu, hiçbir otomatik açılma yoktu ve bir
// yöneticinin bunu geri açtığı bir ekran da yoktu; bilinen bir e-posta
// adresine sahip herkes o hesabı kasıtlı ve süresiz kilitleyebilirdi
// (hedefe yönelik DoS). Artık `active`'ten AYRI, GEÇİCİ bir
// `lockedUntil` alanı kullanılıyor — süre dolunca kullanıcı kendiliğinden
// tekrar deneyebilir, yöneticiye bağımlı kalmaz.
const LOCKOUT_MINUTES = 15;

async function requestMeta() {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '';
  const userAgent = h.get('user-agent') || '';
  return { ip, userAgent };
}

async function finalizeLogin(userId: string, companyId: string): Promise<never> {
  const { ip, userAgent } = await requestMeta();
  const { sessionId, sessionToken } = await createUserSession({ companyId, userId, ip, userAgent });
  await setSessionCookie({ sessionId, userId, companyId, sessionToken });
  await writeAuditLog({ companyId, userId, action: 'LOGIN', entity: 'USER', entityId: userId, module: 'SECURITY', riskLevel: 'LOW', ip, device: userAgent });
  redirect('/dashboard');
}

// emakerp/src/actions/auth.ts:login ile AYNI disiplin, tek-fabrika/tek-DB
// sadeleştirmesiyle. Core Security Faz 5 — MFA etkinse burada oturum
// AÇILMAZ, yalnızca kısa ömürlü bir "mfaPendingToken" üretilir (bkz.
// lib/session.ts:signMfaPendingToken) — gerçek oturum verifyMfaAndLogin'de
// açılır.
export async function login(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  const { email, password } = parsed.data;

  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Güvenlik denetimi 2026-09-03, bulgu 2.6 — verifyPassword her zaman
  // çalıştırılır (bulunamayan e-postada DUMMY_PASSWORD_HASH'e karşı,
  // sonucu ATILARAK) — böylece "e-posta yok" ile "e-posta var, şifre
  // yanlış" yanıt süreleri eşitlenir, zamanlama tabanlı e-posta keşfi
  // (user enumeration) kapatılır.
  const passwordOk = verifyPassword(password, found?.passwordHash ?? DUMMY_PASSWORD_HASH);

  // Bulgu 2.5 — geçici kilit, şifre doğru girilse bile ÖNCE kontrol edilir
  // (verifyPassword yine de yukarıda ÇALIŞTIRILDI, zamanlama eşitliği bozulmaz).
  if (found?.lockedUntil && found.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((found.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Çok fazla hatalı deneme — hesap geçici olarak kilitli. ${minutesLeft} dakika sonra tekrar deneyin.` };
  }

  if (!found || !passwordOk) {
    if (found) {
      const attempts = found.failedLoginAttempts + 1;
      const shouldLock = attempts >= FAILED_LOGIN_LIMIT;
      await db.update(users).set({
        failedLoginAttempts: shouldLock ? 0 : attempts,
        ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) } : {})
      }).where(eq(users.id, found.id));
      const { ip, userAgent } = await requestMeta();
      await writeAuditLog({ companyId: found.companyId, userId: found.id, action: 'LOGIN_FAILED', entity: 'USER', entityId: found.id, module: 'SECURITY', riskLevel: shouldLock ? 'HIGH' : 'MEDIUM', result: 'FAILURE', ip, device: userAgent });
    }
    return { error: 'E-posta veya şifre hatalı.' };
  }
  if (!found.active) return { error: 'Bu kullanıcı pasifleştirilmiş — giriş yapılamaz.' };

  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, found.id));

  if (found.mfaEnabled) {
    const mfaPendingToken = await signMfaPendingToken({ userId: found.id, companyId: found.companyId });
    return { mfaRequired: true, mfaPendingToken };
  }

  await finalizeLogin(found.id, found.companyId);
}

const VerifyMfaSchema = z.object({ mfaPendingToken: z.string().trim().min(1), code: z.string().trim().min(1, 'Kod gerekli.') });

export async function verifyMfaAndLogin(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = VerifyMfaSchema.safeParse({ mfaPendingToken: formData.get('mfaPendingToken'), code: formData.get('code') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const pending = await verifyMfaPendingToken(parsed.data.mfaPendingToken);
  if (!pending) return { error: 'Oturum süresi doldu — lütfen tekrar giriş yapın.' };

  const [user] = await db.select({ id: users.id, active: users.active, failedLoginAttempts: users.failedLoginAttempts, lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, pending.userId)).limit(1);
  if (!user || !user.active) return { error: 'Bu kullanıcı pasifleştirilmiş — giriş yapılamaz.' };

  // Bulgu 2.5 — login()'deki AYNI geçici kilit kontrolü, MFA kod tahmini için de.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Çok fazla hatalı deneme — hesap geçici olarak kilitli. ${minutesLeft} dakika sonra tekrar deneyin.` };
  }

  const ok = await verifyMfaCode(pending.userId, parsed.data.code);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= FAILED_LOGIN_LIMIT;
    await db.update(users).set({
      failedLoginAttempts: shouldLock ? 0 : attempts,
      ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) } : {})
    }).where(eq(users.id, pending.userId));
    const { ip, userAgent } = await requestMeta();
    await writeAuditLog({ companyId: pending.companyId, userId: pending.userId, action: 'LOGIN_FAILED', entity: 'USER', entityId: pending.userId, module: 'SECURITY', riskLevel: 'HIGH', result: 'FAILURE', ip, device: userAgent, changedFields: { reason: 'MFA_INVALID' } });
    return { error: shouldLock ? `Çok fazla hatalı deneme — hesap ${LOCKOUT_MINUTES} dakika kilitlendi.` : 'Doğrulama kodu hatalı.', mfaRequired: true, mfaPendingToken: parsed.data.mfaPendingToken };
  }

  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, pending.userId));
  await finalizeLogin(pending.userId, pending.companyId);
}

export async function logout(): Promise<void> {
  const pointer = await readSessionCookie();
  if (pointer) {
    await revokeSession(pointer.companyId, pointer.sessionId, pointer.userId);
    await writeAuditLog({ companyId: pointer.companyId, userId: pointer.userId, action: 'LOGOUT', entity: 'USER', entityId: pointer.userId, module: 'SECURITY', riskLevel: 'LOW' });
  }
  await clearSessionCookie();
  redirect('/login');
}
