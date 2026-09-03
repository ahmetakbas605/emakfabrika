import 'server-only';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// SATINALMA-MİMARİSİ Faz 0 (madde 25-28) — bu fabrikanın KENDİ sunucusu
// (tek-sunucu on-prem model, TENANT-ARCHITECTURE.md'nin geri kalanıyla
// AYNI ilke) — S3/cloud object storage abstraction'ı BİLİNÇLİ OLARAK YOK,
// yerel disk yeterli ve daha az bağımlılık. UPLOADS_DIR env ile
// değiştirilebilir (varsayılan: proje kökünde uploads/, .gitignore'da).
const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

// madde 26 — MIME/uzantı/boyut doğrulaması. Malware taraması (madde 26
// "abstraction") bilinçli olarak YOK — gerçek bir AV motoru entegrasyonu
// olmadan sahte bir "tarandı" bayrağı koymak yanıltıcı olur, TODO:
// MALWARE_SCAN_PROVIDER (üretim dağıtımı netleşmeden tahmin edilmeyecek).
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function validateFile(mimeType: string, sizeBytes: number): { ok: true } | { ok: false; reason: string } {
  if (sizeBytes <= 0) return { ok: false, reason: 'Boş dosya yüklenemez.' };
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return { ok: false, reason: `Dosya çok büyük (maksimum ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB).` };
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return { ok: false, reason: `Desteklenmeyen dosya türü: ${mimeType}` };
  return { ok: true };
}

// storageKey her zaman companyId/entityType/entityId ile başlar — çağıran
// tarafın (lib/documents/attachments.ts) DB satırındaki companyId ile
// zaten doğruladığı bir yol, ama dizin yapısında da izolasyon (savunma
// derinliği). fileName, path traversal'a karşı sterilize edilir.
export async function saveFile(companyId: string, entityType: string, entityId: string, fileName: string, buffer: Buffer): Promise<string> {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
  const key = path.posix.join(companyId, entityType, entityId, `${randomUUID()}-${safeFileName}`);
  const fullPath = path.join(UPLOADS_ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return key;
}

// Güvenlik denetimi 2026-09-03, bulgu 2.8 — bugün TEK çağıran
// (lib/documents/attachments.ts) storageKey'i her zaman veritabanından
// (saveFile'ın kendi ürettiği, temizlenmiş bir değer) okuyor, yani
// saldırgan girdisi buraya bugün ULAŞMIYOR. Ama bu iki fonksiyon kendi
// başına path-traversal'a karşı hiçbir doğrulama yapmıyordu — ileride
// yeni bir çağıran (ör. bir indirme ekranı) bu detayı unutursa savunma
// derinliği yoktu. resolvedPath, UPLOADS_ROOT'un dışına ÇIKARSA reddedilir.
function resolveWithinUploadsRoot(storageKey: string): string {
  const resolved = path.resolve(UPLOADS_ROOT, storageKey);
  const rootWithSep = path.resolve(UPLOADS_ROOT) + path.sep;
  if (resolved !== path.resolve(UPLOADS_ROOT) && !resolved.startsWith(rootWithSep)) {
    throw new Error('Geçersiz depolama anahtarı (UPLOADS_ROOT dışına çıkıyor).');
  }
  return resolved;
}

export async function readFileByKey(storageKey: string): Promise<Buffer> {
  return readFile(resolveWithinUploadsRoot(storageKey));
}

export async function deleteFileByKey(storageKey: string): Promise<void> {
  await unlink(resolveWithinUploadsRoot(storageKey)).catch(() => {});
}
