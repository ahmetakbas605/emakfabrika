import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { legalLawsuits, legalContracts, parties, users, LEGAL_LAWSUIT_STATUSES } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { toDb } from '@/lib/money';
import { LegalError } from './errors';

export interface CreateLawsuitInput {
  title: string;
  companyRole: (typeof legalLawsuits.$inferInsert)['companyRole'];
  counterpartyPartyId?: string;
  counterpartyName?: string;
  contractId?: string;
  claimAmount?: number;
  currencyCode?: string;
  courtName?: string;
  filedDate?: string;
  ownerUserId?: string;
  notes?: string;
}

export async function createLawsuit(companyId: string, createdByUserId: string, input: CreateLawsuitInput): Promise<string> {
  if (input.contractId) {
    const [contract] = await db.select({ id: legalContracts.id }).from(legalContracts).where(and(eq(legalContracts.id, input.contractId), eq(legalContracts.companyId, companyId))).limit(1);
    if (!contract) throw new LegalError('Sözleşme bulunamadı.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const caseNo = await nextDocumentNo(tx, companyId, 'LL', 'DVA', new Date().getFullYear(), 6);
    await tx.insert(legalLawsuits).values({
      id, companyId, caseNo, title: input.title, companyRole: input.companyRole, counterpartyPartyId: input.counterpartyPartyId,
      counterpartyName: input.counterpartyName ?? '', contractId: input.contractId, claimAmount: input.claimAmount === undefined ? undefined : toDb(input.claimAmount),
      currencyCode: input.currencyCode, courtName: input.courtName ?? '', filedDate: input.filedDate, ownerUserId: input.ownerUserId, notes: input.notes, createdByUserId
    });
    return id;
  });
}

export async function listLawsuits(companyId: string) {
  return db
    .select({
      id: legalLawsuits.id, caseNo: legalLawsuits.caseNo, title: legalLawsuits.title, companyRole: legalLawsuits.companyRole,
      counterpartyName: parties.legalName, counterpartyFreeName: legalLawsuits.counterpartyName, status: legalLawsuits.status,
      claimAmount: legalLawsuits.claimAmount, courtName: legalLawsuits.courtName, ownerName: users.fullName
    })
    .from(legalLawsuits)
    .leftJoin(parties, eq(parties.id, legalLawsuits.counterpartyPartyId))
    .leftJoin(users, eq(users.id, legalLawsuits.ownerUserId))
    .where(eq(legalLawsuits.companyId, companyId))
    .orderBy(desc(legalLawsuits.createdAt));
}

export async function getLawsuit(companyId: string, lawsuitId: string) {
  const [row] = await db.select().from(legalLawsuits).where(and(eq(legalLawsuits.id, lawsuitId), eq(legalLawsuits.companyId, companyId))).limit(1);
  if (!row) throw new LegalError('Dava bulunamadı.');
  return row;
}

const TERMINAL_LAWSUIT_STATUSES = ['SETTLED', 'WON', 'LOST', 'CLOSED'] as const;

export async function updateLawsuitStatus(companyId: string, lawsuitId: string, status: (typeof LEGAL_LAWSUIT_STATUSES)[number]): Promise<void> {
  const lawsuit = await getLawsuit(companyId, lawsuitId);
  if ((TERMINAL_LAWSUIT_STATUSES as readonly string[]).includes(lawsuit.status)) throw new LegalError('Sonuçlanmış (SETTLED/WON/LOST/CLOSED) bir davanın durumu değiştirilemez.');
  const isNowTerminal = (TERMINAL_LAWSUIT_STATUSES as readonly string[]).includes(status);
  await db.update(legalLawsuits).set({ status, closedAt: isNowTerminal ? new Date() : undefined }).where(eq(legalLawsuits.id, lawsuitId));
}
