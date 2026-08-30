import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

// emakerp/src/lib/session.ts ile AYNI desen ("database session" — çerez
// yalnızca imzalı bir işaretçi taşır, gerçek doğrulama her istekte DB'ye
// karşı yapılır, bkz. lib/dal.ts:getSession).
const COOKIE_NAME = 'emakfabrika_session';
const SESSION_DAYS = 7;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET tanımlı değil — .env dosyasını kontrol edin.');
  return new TextEncoder().encode(secret);
}

// Core Security Faz 4 — pointer artık HANGİ user_sessions satırına ait
// olduğunu (sessionId) taşıyor, tek bir users.sessionToken'a değil —
// bu, aynı kullanıcının BİRDEN FAZLA eşzamanlı web oturumuna sahip
// olabilmesini (ve her birinin AYRI AYRI iptal edilebilmesini) sağlıyor.
export interface SessionPointer {
  sessionId: string;
  userId: string;
  companyId: string;
  sessionToken: string;
}

export async function encryptSessionPointer(payload: SessionPointer): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

export async function decryptSessionPointer(token: string | undefined): Promise<SessionPointer | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    if (typeof payload.sessionId !== 'string' || typeof payload.userId !== 'string' || typeof payload.companyId !== 'string' || typeof payload.sessionToken !== 'string') return null;
    return { sessionId: payload.sessionId, userId: payload.userId, companyId: payload.companyId, sessionToken: payload.sessionToken };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPointer): Promise<void> {
  const token = await encryptSessionPointer(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function readSessionCookie(): Promise<SessionPointer | null> {
  const cookieStore = await cookies();
  return decryptSessionPointer(cookieStore.get(COOKIE_NAME)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Core Security Faz 5 — MFA login'in 2. adımı. Şifre doğru + MFA
// etkinse, TAM oturum HENÜZ AÇILMAZ — bunun yerine kısa ömürlü (5 dk),
// yalnızca userId taşıyan AYRI bir imzalı token üretilir. Bu, MFA doğrulama
// adımının çıplak bir "userId" hidden input'una GÜVENMESİNİ önler (aksi
// halde biri şifre adımını hiç geçmeden doğrudan MFA formuna rastgele bir
// userId+kod deneyebilirdi).
const MFA_PENDING_MINUTES = 5;

export interface MfaPendingPayload {
  userId: string;
  companyId: string;
}

export async function signMfaPendingToken(payload: MfaPendingPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'mfa_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MFA_PENDING_MINUTES}m`)
    .sign(getSecretKey());
}

export async function verifyMfaPendingToken(token: string): Promise<MfaPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'mfa_pending' || typeof payload.userId !== 'string' || typeof payload.companyId !== 'string') return null;
    return { userId: payload.userId, companyId: payload.companyId };
  } catch {
    return null;
  }
}
