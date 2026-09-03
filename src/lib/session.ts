import 'server-only';
import crypto from 'crypto';
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

// Faz 13 (Integration Hub) — emakerp'ten gelen giriş-yönlendirme (handoff).
// signMfaPendingToken İLE AYNI desen (kısa ömürlü, tek-amaçlı, imzalı
// token) — emakerp zaten e-posta/şifreyi kendi tarafında doğruladı
// (lib/integration/external-auth.ts:issueHandoffToken), bu token yalnızca
// "bu kullanıcı doğrulandı, oturum açılabilir" der; çıplak bir userId'ye
// GÜVENMEZ (MFA pending token'ın AYNI gerekçesi). 60 saniyelik ömür
// BİLİNÇLİ OLARAK kısa — bu token yalnızca TEK bir HTTP yönlendirmesi
// boyunca yaşamalı, e-posta linki gibi uzun süre canlı kalan bir "magic
// link" DEĞİL.
const HANDOFF_TOKEN_SECONDS = 60;

// Güvenlik denetimi 2026-09-03, bulgu 2.2 — yukarıdaki yorum "tek bir HTTP
// yönlendirmesi boyunca yaşamalı" diyordu ama gerçek bir tek-kullanımlık
// (replay) koruması YOKTU: aynı token 60 saniyelik pencere içinde birden
// fazla kez kullanılabilirdi (paylaşılan makine geçmişi/proxy logu gibi bir
// sızıntı olursa). Tek fabrika sunucusu (cluster YOK, TENANT-ARCHITECTURE.md)
// olduğu için bir DB tablosu yerine bellek-içi bir "tüketildi" kümesi yeterli
// ve daha az riskli (yeni migration yok) — jti 60 saniyeden fazla anlamlı
// olmadığı için sunucu yeniden başlarsa küme sıfırlanması kabul edilebilir
// bir artık risk (aynı dar pencere zaten JWT'nin kendi süresiyle de sınırlı).
const consumedHandoffJtis = new Map<string, number>();

function pruneConsumedHandoffJtis(): void {
  const now = Date.now();
  for (const [jti, expiresAt] of consumedHandoffJtis) {
    if (expiresAt < now) consumedHandoffJtis.delete(jti);
  }
}

export interface ExternalHandoffPayload {
  userId: string;
  companyId: string;
}

export async function signExternalHandoffToken(payload: ExternalHandoffPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'external_handoff' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${HANDOFF_TOKEN_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyExternalHandoffToken(token: string): Promise<ExternalHandoffPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'external_handoff' || typeof payload.userId !== 'string' || typeof payload.companyId !== 'string' || typeof payload.jti !== 'string') return null;

    pruneConsumedHandoffJtis();
    if (consumedHandoffJtis.has(payload.jti)) return null; // tekrar kullanım (replay) — reddedildi
    consumedHandoffJtis.set(payload.jti, Date.now() + HANDOFF_TOKEN_SECONDS * 1000);

    return { userId: payload.userId, companyId: payload.companyId };
  } catch {
    return null;
  }
}
