import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { personalDataInventory, DATA_CLASSIFICATIONS } from '@/db/schema';
import { newId } from '@/lib/id';
import { SecurityError } from './errors';

// Core Security Faz 3 (rapor §04, madde 3-4) — kişisel veri envanteri. Bu
// bir ÇALIŞMA ZAMANI kontrolü DEĞİL, bir REHBER/dokümantasyon — gerçek
// maskeleme lib/security/masking.ts'te KOD İÇİNDE ayrıca uygulanır.

export interface UpsertInventoryEntryInput {
  tableName: string;
  columnName: string;
  dataCategory?: string;
  classification: (typeof DATA_CLASSIFICATIONS)[number];
  purpose?: string;
  legalBasis?: string;
  encryptionRequired?: boolean;
  maskingRequired?: boolean;
  exportAllowed?: boolean;
}

export async function upsertInventoryEntry(companyId: string, input: UpsertInventoryEntryInput): Promise<string> {
  const [existing] = await db.select({ id: personalDataInventory.id }).from(personalDataInventory).where(and(eq(personalDataInventory.companyId, companyId), eq(personalDataInventory.tableName, input.tableName), eq(personalDataInventory.columnName, input.columnName))).limit(1);

  if (existing) {
    await db.update(personalDataInventory).set({
      dataCategory: input.dataCategory ?? '', classification: input.classification, purpose: input.purpose ?? '', legalBasis: input.legalBasis ?? '',
      encryptionRequired: input.encryptionRequired ?? false, maskingRequired: input.maskingRequired ?? false, exportAllowed: input.exportAllowed ?? true
    }).where(eq(personalDataInventory.id, existing.id));
    return existing.id;
  }

  const id = newId();
  await db.insert(personalDataInventory).values({
    id, companyId, tableName: input.tableName, columnName: input.columnName, dataCategory: input.dataCategory ?? '', classification: input.classification,
    purpose: input.purpose ?? '', legalBasis: input.legalBasis ?? '', encryptionRequired: input.encryptionRequired ?? false, maskingRequired: input.maskingRequired ?? false, exportAllowed: input.exportAllowed ?? true
  });
  return id;
}

export async function listInventory(companyId: string) {
  return db.select().from(personalDataInventory).where(eq(personalDataInventory.companyId, companyId)).orderBy(personalDataInventory.tableName, personalDataInventory.columnName);
}

export async function deleteInventoryEntry(companyId: string, entryId: string): Promise<void> {
  const [entry] = await db.select({ id: personalDataInventory.id }).from(personalDataInventory).where(and(eq(personalDataInventory.id, entryId), eq(personalDataInventory.companyId, companyId))).limit(1);
  if (!entry) throw new SecurityError('Envanter kaydı bulunamadı.');
  await db.delete(personalDataInventory).where(eq(personalDataInventory.id, entryId));
}
