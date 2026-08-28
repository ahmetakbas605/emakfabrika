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

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
