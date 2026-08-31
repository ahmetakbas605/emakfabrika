import 'server-only';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { legalContracts, parties, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { toDb } from '@/lib/money';
import { LegalError } from './errors';

export interface CreateContractInput {
  title: string;
  contractType: (typeof legalContracts.$inferInsert)['contractType'];
  counterpartyPartyId?: string;
  counterpartyName?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  currencyCode?: string;
  ownerUserId?: string;
  notes?: string;
}

export async function createContract(companyId: string, createdByUserId: string, input: CreateContractInput): Promise<string> {
  if (input.endDate && input.startDate && input.endDate < input.startDate) throw new LegalError('Bitiş tarihi başlangıçtan önce olamaz.');

  return db.transaction(async (tx) => {
    const id = newId();
    const contractNo = await nextDocumentNo(tx, companyId, 'LC', 'SZL', new Date().getFullYear(), 6);
    await tx.insert(legalContracts).values({
      id, companyId, contractNo, title: input.title, contractType: input.contractType, counterpartyPartyId: input.counterpartyPartyId,
      counterpartyName: input.counterpartyName ?? '', startDate: input.startDate, endDate: input.endDate,
      value: input.value === undefined ? undefined : toDb(input.value), currencyCode: input.currencyCode, ownerUserId: input.ownerUserId,
      notes: input.notes, createdByUserId
    });
    return id;
  });
}

export async function listContracts(companyId: string) {
  return db
    .select({
      id: legalContracts.id, contractNo: legalContracts.contractNo, title: legalContracts.title, contractType: legalContracts.contractType,
      status: legalContracts.status, counterpartyName: parties.legalName, counterpartyFreeName: legalContracts.counterpartyName,
      startDate: legalContracts.startDate, endDate: legalContracts.endDate, value: legalContracts.value, ownerName: users.fullName
    })
    .from(legalContracts)
    .leftJoin(parties, eq(parties.id, legalContracts.counterpartyPartyId))
    .leftJoin(users, eq(users.id, legalContracts.ownerUserId))
    .where(eq(legalContracts.companyId, companyId))
    .orderBy(desc(legalContracts.createdAt));
}

export async function getContract(companyId: string, contractId: string) {
  const [row] = await db.select().from(legalContracts).where(and(eq(legalContracts.id, contractId), eq(legalContracts.companyId, companyId))).limit(1);
  if (!row) throw new LegalError('Sözleşme bulunamadı.');
  return row;
}

export async function updateContractStatus(companyId: string, contractId: string, status: (typeof legalContracts.$inferInsert)['status']): Promise<void> {
  await getContract(companyId, contractId);
  await db.update(legalContracts).set({ status }).where(eq(legalContracts.id, contractId));
}

// lib/fleet/vehicles.ts:listExpiringVehicleDocuments İLE AYNI zaman-
// penceresi raporu deseni — bu oturumda tekrar tekrar uygulanan "talep
// üzerine hesaplanan rapor" ailesinin bir zaman-bazlı varyantı.
export async function listExpiringContracts(companyId: string, withinDays: number) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return db
    .select({ id: legalContracts.id, contractNo: legalContracts.contractNo, title: legalContracts.title, endDate: legalContracts.endDate })
    .from(legalContracts)
    .where(and(eq(legalContracts.companyId, companyId), eq(legalContracts.status, 'ACTIVE'), gte(legalContracts.endDate, today), lte(legalContracts.endDate, horizon)));
}
