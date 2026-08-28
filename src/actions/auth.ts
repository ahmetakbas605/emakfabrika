'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyPassword, generateSessionToken } from '@/lib/auth';
import { setSessionCookie, readSessionCookie, clearSessionCookie } from '@/lib/session';

export type FormState = { error?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta girin.'),
  password: z.string().min(1, 'Şifre gerekli.')
});

const FAILED_LOGIN_LIMIT = 5;
const SESSION_DAYS = 7;

// emakerp/src/actions/auth.ts:login ile AYNI disiplin, tek-fabrika/tek-DB
// sadeleştirmesiyle: e-posta zaten bu DB içinde benzersiz (users.email
// UNIQUE) — emakerp'teki "hangi kiracı" belirsizliği burada YOK.
export async function login(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  const { email, password } = parsed.data;

  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!found || !verifyPassword(password, found.passwordHash)) {
    if (found) {
      const attempts = found.failedLoginAttempts + 1;
      const shouldLock = attempts >= FAILED_LOGIN_LIMIT && found.active;
      await db.update(users).set({ failedLoginAttempts: attempts, ...(shouldLock ? { active: false } : {}) }).where(eq(users.id, found.id));
    }
    return { error: 'E-posta veya şifre hatalı.' };
  }
  if (!found.active) return { error: 'Bu kullanıcı pasifleştirilmiş — giriş yapılamaz.' };

  const sessionToken = generateSessionToken();
  const sessionExpiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.update(users).set({ sessionToken, sessionExpiresAt, failedLoginAttempts: 0 }).where(eq(users.id, found.id));

  await setSessionCookie({ userId: found.id, companyId: found.companyId, sessionToken });
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const pointer = await readSessionCookie();
  if (pointer) {
    await db.update(users).set({ sessionToken: null, sessionExpiresAt: null }).where(eq(users.id, pointer.userId));
  }
  await clearSessionCookie();
  redirect('/login');
}
