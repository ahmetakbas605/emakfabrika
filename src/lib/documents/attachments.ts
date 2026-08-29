import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { documentAttachments } from '@/db/schema';
import { newId } from '@/lib/id';
import { CoreError } from '@/lib/core/errors';
import { saveFile, readFileByKey, deleteFileByKey, validateFile } from './storage';

// entityType serbest metin ('PROCUREMENT_REQUEST_LINE' gibi) — herhangi
// bir modül kullanabilir, bu dosya procurement'a özel değil.

export interface UploadAttachmentInput {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: string;
}

export async function uploadAttachment(companyId: string, input: UploadAttachmentInput): Promise<string> {
  const check = validateFile(input.mimeType, input.buffer.length);
  if (!check.ok) throw new CoreError(check.reason);

  const storageKey = await saveFile(companyId, input.entityType, input.entityId, input.fileName, input.buffer);
  const id = newId();
  await db.insert(documentAttachments).values({
    id, companyId,
    entityType: input.entityType,
    entityId: input.entityId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    storageKey,
    uploadedByUserId: input.uploadedByUserId
  });
  return id;
}

export async function listAttachments(companyId: string, entityType: string, entityId: string) {
  return db.select().from(documentAttachments).where(and(eq(documentAttachments.companyId, companyId), eq(documentAttachments.entityType, entityType), eq(documentAttachments.entityId, entityId)));
}

export interface AttachmentFile {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export async function getAttachmentFile(companyId: string, attachmentId: string): Promise<AttachmentFile> {
  const [row] = await db.select().from(documentAttachments).where(and(eq(documentAttachments.id, attachmentId), eq(documentAttachments.companyId, companyId))).limit(1);
  if (!row) throw new CoreError('Dosya bulunamadı.');
  const buffer = await readFileByKey(row.storageKey);
  return { fileName: row.fileName, mimeType: row.mimeType, buffer };
}

// madde 116-117 "immutable" ilkesiyle tutarlı olarak normal akışta
// SİLİNMEZ — yalnızca yükleyen kullanıcının kendi hatalı yüklemesini geri
// almak gibi dar bir senaryo için var, genel bir "düzenle/kaldır" UI akışı
// BİLİNÇLİ OLARAK kurulmadı.
export async function deleteAttachment(companyId: string, attachmentId: string, requestingUserId: string): Promise<void> {
  const [row] = await db.select().from(documentAttachments).where(and(eq(documentAttachments.id, attachmentId), eq(documentAttachments.companyId, companyId))).limit(1);
  if (!row) throw new CoreError('Dosya bulunamadı.');
  if (row.uploadedByUserId !== requestingUserId) throw new CoreError('Yalnızca yükleyen kişi bu dosyayı kaldırabilir.');
  await db.delete(documentAttachments).where(eq(documentAttachments.id, attachmentId));
  await deleteFileByKey(row.storageKey);
}
