import 'server-only';
import { generateSecret as generateTotpSecret, generateURI as generateTotpURI, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { encryptSecret, decryptSecret, parseHexKey } from '@/lib/crypto';
import { SecurityError } from './errors';

// Core Security Faz 5 — TOTP (RFC 6238). otplib + lib/crypto.ts'in AYNI
// AES-256-GCM yardımcısı (ayrı env-var anahtarı: MFA_ENC_KEY — IT'nin
// network_credentials'ının kullandığı IT_CREDENTIALS_ENC_KEY'den AYRI,
// "birinin sızması diğerini etkilemez" ilkesi).
function getKey() {
  const key = parseHexKey(process.env.MFA_ENC_KEY, 'MFA_ENC_KEY');
  if (!key) throw new SecurityError('MFA_ENC_KEY tanımlı değil — .env dosyasını kontrol edin.');
  return key;
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}

export interface MfaSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

// Adım 1 — kullanıcı henüz MFA'yı ETKİNLEŞTİRMEDİ, yalnızca kurulum
// materyalini üretir (secret ŞİFRELENMİŞ olarak DB'ye yazılır ama
// mfaEnabled hâlâ false — confirmMfaSetup ile ilk doğru kod girilene
// kadar gerçek anlamda AKTİF olmaz, yanlışlıkla kilitlenmeyi önler).
export async function beginMfaSetup(companyId: string, userId: string, accountLabel: string): Promise<MfaSetupResult> {
  const secret = generateTotpSecret();
  const otpauth = generateTotpURI({ issuer: 'emakfabrika', label: accountLabel, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
  const recoveryCodes = generateRecoveryCodes();
  const recoveryCodesHash = recoveryCodes.map(hashRecoveryCode);

  await db.update(users).set({ totpSecretEncrypted: encryptSecret(secret, getKey()), mfaRecoveryCodesHash: recoveryCodesHash }).where(eq(users.id, userId));
  return { secret, qrCodeDataUrl, recoveryCodes };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<void> {
  const [user] = await db.select({ totpSecretEncrypted: users.totpSecretEncrypted }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.totpSecretEncrypted) throw new SecurityError('Önce MFA kurulumu başlatılmalı.');
  const secret = decryptSecret(user.totpSecretEncrypted, getKey());
  if (!secret || !(await verifyTotp({ secret, token: code })).valid) throw new SecurityError('Doğrulama kodu hatalı.');
  await db.update(users).set({ mfaEnabled: true, mfaEnabledAt: new Date() }).where(eq(users.id, userId));
}

export async function disableMfa(userId: string): Promise<void> {
  await db.update(users).set({ mfaEnabled: false, totpSecretEncrypted: null, mfaRecoveryCodesHash: null, mfaEnabledAt: null }).where(eq(users.id, userId));
}

// Login akışının 2. adımı — düz metin kod VEYA kurtarma kodlarından biri.
// Kullanılan kurtarma kodu TEKRAR KULLANILAMAZ hale getirilir (listeden
// çıkarılır) — madde 14'ün "tek kullanımlık kurtarma kodu" ilkesi.
export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const [user] = await db.select({ totpSecretEncrypted: users.totpSecretEncrypted, mfaRecoveryCodesHash: users.mfaRecoveryCodesHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.totpSecretEncrypted) return false;
  const secret = decryptSecret(user.totpSecretEncrypted, getKey());
  if (secret && (await verifyTotp({ secret, token: code })).valid) return true;

  const recoveryHashes = (user.mfaRecoveryCodesHash as string[] | null) ?? [];
  const candidateHash = hashRecoveryCode(code.trim());
  if (recoveryHashes.includes(candidateHash)) {
    await db.update(users).set({ mfaRecoveryCodesHash: recoveryHashes.filter((h) => h !== candidateHash) }).where(eq(users.id, userId));
    return true;
  }
  return false;
}
