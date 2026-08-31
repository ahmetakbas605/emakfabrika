import 'server-only';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { envPermits } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { EnvironmentError } from './errors';

export interface CreateEnvPermitInput {
  permitType: (typeof envPermits.$inferInsert)['permitType'];
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export async function createEnvPermit(companyId: string, createdByUserId: string, input: CreateEnvPermitInput): Promise<string> {
  if (input.expiryDate && input.issueDate && input.expiryDate < input.issueDate) throw new EnvironmentError('Son geçerlilik tarihi düzenleme tarihinden önce olamaz.');

  return db.transaction(async (tx) => {
    const id = newId();
    const permitNo = await nextDocumentNo(tx, companyId, 'ENVP', 'CVR', new Date().getFullYear(), 6);
    await tx.insert(envPermits).values({
      id, companyId, permitNo, permitType: input.permitType, issuingAuthority: input.issuingAuthority ?? '',
      issueDate: input.issueDate, expiryDate: input.expiryDate, notes: input.notes, createdByUserId
    });
    return id;
  });
}

export async function listEnvPermits(companyId: string) {
  return db.select().from(envPermits).where(eq(envPermits.companyId, companyId)).orderBy(envPermits.expiryDate);
}

// lib/legal/contracts.ts:listExpiringContracts İLE AYNI zaman-penceresi
// raporu deseni.
export async function listExpiringEnvPermits(companyId: string, withinDays: number) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return db
    .select({ id: envPermits.id, permitNo: envPermits.permitNo, permitType: envPermits.permitType, expiryDate: envPermits.expiryDate })
    .from(envPermits)
    .where(and(eq(envPermits.companyId, companyId), eq(envPermits.status, 'ACTIVE'), gte(envPermits.expiryDate, today), lte(envPermits.expiryDate, horizon)));
}
