import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { opportunities, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { SalesError } from './errors';

export interface CreateOpportunityInput {
  partyId: string;
  leadId?: string;
  name: string;
  estimatedValue?: number;
  currencyCode?: string;
  expectedCloseDate?: string;
  assignedToUserId?: string;
}

async function requireParty(tx: Tx, companyId: string, partyId: string): Promise<void> {
  const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, partyId), eq(parties.companyId, companyId))).limit(1);
  if (!party) throw new SalesError('Cari kartı bulunamadı.');
}

export async function createOpportunity(companyId: string, createdByUserId: string, input: CreateOpportunityInput): Promise<string> {
  return db.transaction((tx) => createOpportunityInTx(tx, companyId, createdByUserId, input));
}

// lib/sales/leads.ts:convertLeadToOpportunity'nin ...InTx ihtiyacı — parties.ts:createPartyInTx İLE AYNI gerekçe.
export async function createOpportunityInTx(tx: Tx, companyId: string, createdByUserId: string, input: CreateOpportunityInput): Promise<string> {
  await requireParty(tx, companyId, input.partyId);
  const id = newId();
  await tx.insert(opportunities).values({
    id, companyId, partyId: input.partyId, leadId: input.leadId, name: input.name,
    estimatedValue: input.estimatedValue === undefined ? undefined : String(input.estimatedValue),
    currencyCode: input.currencyCode, expectedCloseDate: input.expectedCloseDate, assignedToUserId: input.assignedToUserId, createdByUserId
  });
  return id;
}

export async function listOpportunities(companyId: string, partyId?: string) {
  const conditions = partyId ? and(eq(opportunities.companyId, companyId), eq(opportunities.partyId, partyId)) : eq(opportunities.companyId, companyId);
  return db
    .select({
      id: opportunities.id, name: opportunities.name, stage: opportunities.stage, estimatedValue: opportunities.estimatedValue,
      currencyCode: opportunities.currencyCode, expectedCloseDate: opportunities.expectedCloseDate, partyId: opportunities.partyId,
      partyName: parties.legalName, createdAt: opportunities.createdAt
    })
    .from(opportunities)
    .innerJoin(parties, eq(parties.id, opportunities.partyId))
    .where(conditions)
    .orderBy(desc(opportunities.createdAt));
}

export async function getOpportunity(companyId: string, opportunityId: string) {
  const [row] = await db.select().from(opportunities).where(and(eq(opportunities.id, opportunityId), eq(opportunities.companyId, companyId))).limit(1);
  if (!row) throw new SalesError('Fırsat bulunamadı.');
  return row;
}

// madde (Sales Funnel) — WON/LOST terminal durumlardır (bonus_requests'in
// APPROVED/REJECTED'i İLE AYNI ilke, bir kez kapanan fırsat yeniden açılmaz,
// yeni bir fırsat oluşturulur).
export async function setOpportunityStage(companyId: string, opportunityId: string, stage: (typeof opportunities.$inferInsert)['stage'], lostReason?: string): Promise<void> {
  const opp = await getOpportunity(companyId, opportunityId);
  if (opp.stage === 'WON' || opp.stage === 'LOST') throw new SalesError('Kapanmış bir fırsatın aşaması değiştirilemez.');
  if (stage === 'LOST' && !lostReason) throw new SalesError('Fırsat kaybedildi olarak işaretlenirken bir gerekçe girilmeli.');

  const closed = stage === 'WON' || stage === 'LOST';
  await db.update(opportunities).set({ stage, lostReason: stage === 'LOST' ? lostReason : undefined, closedAt: closed ? new Date() : undefined }).where(eq(opportunities.id, opportunityId));
}
