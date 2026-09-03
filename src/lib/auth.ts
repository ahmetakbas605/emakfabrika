import 'server-only';
import crypto from 'crypto';

// emakerp/src/lib/auth.ts ile BİREBİR aynı — pure Node crypto, DB-bağımsız,
// SECURITY-ARCHITECTURE.md §5'te "taşınabilir" olarak işaretlendiği gibi
// aynen kopyalandı. Format: "scrypt:<saltHex>:<hashHex>".
const SCRYPT_KEYLEN = 64;

export function hashPassword(plainText: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainText, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(plainText: string, stored: string): boolean {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const candidate = crypto.scryptSync(plainText, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// Güvenlik denetimi 2026-09-03, bulgu 2.6 — giriş akışı, e-posta
// bulunamadığında verifyPassword'ü (pahalı bir scrypt çağrısı) hiç
// ÇALIŞTIRMADIĞI için "bilinmeyen e-posta" ile "bilinen e-posta + yanlış
// şifre" arasında ölçülebilir bir SÜRE farkı bırakıyordu (e-posta keşfi/
// user enumeration). Bu sabit hash, modül yüklenirken BİR KEZ üretilir;
// e-posta bulunamadığında da verifyPassword bu sahte hash'e karşı
// (sonucu KULLANILMADAN) çalıştırılarak süre eşitlenir — bkz.
// actions/auth.ts:login, lib/mobile-auth.ts:mobileLogin.
export const DUMMY_PASSWORD_HASH = hashPassword('bulgu-2.6-zamanlama-esitleme-sahte-sifre');

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Güvenlik denetimi 2026-09-03, bulgu 2.1 — oturum token'ları (web
// user_sessions.session_token / mobil users.mobile_session_token) DB'de
// düz metin duruyordu: parolalar scrypt ile hash'lenirken bir DB sızıntısı
// oturumları anında ele geçirilebilir kılardı. Token zaten crypto.randomBytes
// ile yüksek entropili (256 bit) üretildiği için mfa.ts:hashRecoveryCode İLE
// AYNI gerekçeyle yavaş bir KDF (scrypt) GEREKMİYOR — SHA-256 yeterli. Çerez/
// Authorization header'da HÂLÂ ham token taşınır, yalnızca DB'ye yazılan
// değer değişti (bkz. lib/security/sessions.ts, lib/mobile-auth.ts).
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
