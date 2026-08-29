import 'server-only';
import crypto from 'crypto';

// emakerp/src/lib/crypto.ts İLE BİREBİR AYNI (emakelektron/emakbilisim'deki
// aynı formatın paylaşılan hâli) — AES-256-GCM, "enc:" + base64(iv(12) +
// authTag(16) + ciphertext). IT-SECURITY.md §1 — IT_CREDENTIALS_ENC_KEY ile
// kullanılır (lib/it/network-credentials.ts), EFATURA_ENC_KEY'den AYRI
// (her domain kendi anahtarını kullanır — birinin sızması diğerini etkilemez).
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:';

export function parseHexKey(raw: string | undefined, envVarName: string): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error(`${envVarName} 32 byte olmalı (64 hex karakter) — .env dosyasını kontrol edin.`);
  return key;
}

export function encryptSecret(plainText: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(value: string | null | undefined, key: Buffer): string | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
