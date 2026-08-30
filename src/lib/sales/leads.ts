import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { leads, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { createPartyInTx } from '@/lib/master-data/parties';
import { createOpportunityInTx } from '@/lib/sales/opportunities';
import { SalesError } from './errors';

// Holding ERP Faz 1 — Aday Müşteri (Lead). Henüz bir Party DEĞİL (madde 3'ün
// "aday müşteri" adımı, gerçek bir cari kartı açmadan ÖNCEki durum) —
// convertLead ile ya YENİ bir parties satırına (CUSTOMER rolüyle) ya da
// zaten var olan bir cariye eşleşir.

export interface CreateLeadInput {
  contactName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  assignedToUserId?: string;
  notes?: string;
}

export async function createLead(companyId: string, createdByUserId: string, input: CreateLeadInput): Promise<string> {
  const id = newId();
  await db.insert(leads).values({
    id, companyId, contactName: input.contactName, companyName: input.companyName ?? '', email: input.email ?? '',
    phone: input.phone ?? '', source: input.source ?? '', assignedToUserId: input.assignedToUserId, notes: input.notes, createdByUserId
  });
  return id;
}

export async function listLeads(companyId: string) {
  return db.select().from(leads).where(eq(leads.companyId, companyId)).orderBy(desc(leads.createdAt));
}

export async function getLead(companyId: string, leadId: string) {
  const [row] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.companyId, companyId))).limit(1);
  if (!row) throw new SalesError('Aday müşteri bulunamadı.');
  return row;
}

export async function updateLeadStatus(companyId: string, leadId: string, status: (typeof leads.$inferInsert)['status']): Promise<void> {
  const lead = await getLead(companyId, leadId);
  if (lead.status === 'CONVERTED') throw new SalesError('Dönüştürülmüş bir aday müşterinin durumu değiştirilemez.');
  await db.update(leads).set({ status }).where(eq(leads.id, leadId));
}

export interface ConvertLeadInput {
  opportunityName: string;
  estimatedValue?: number;
  currencyCode?: string;
  expectedCloseDate?: string;
  // Doluysa aday müşteri, ZATEN VAR olan bir cari karta eşleşir (ör. mevcut
  // müşterinin yeni bir talebi) — boşsa lead'in kendi bilgilerinden YENİ bir
  // Party (CUSTOMER rolüyle) oluşturulur.
  existingPartyId?: string;
}

// madde 3 (Aday Müşteri → Fırsat) — TEK transaction: lead CONVERTED'a
// çevrilir, (gerekirse) yeni bir Party doğar, bir Opportunity açılır. Bu
// üçü YARIM kalırsa (ör. Party oluşur ama Opportunity başarısız olursa)
// veri tutarsız kalır — bu yüzden hepsi AYNI transaction'da.
export async function convertLeadToOpportunity(companyId: string, leadId: string, userId: string, input: ConvertLeadInput): Promise<{ partyId: string; opportunityId: string }> {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.companyId, companyId))).limit(1);
    if (!lead) throw new SalesError('Aday müşteri bulunamadı.');
    if (lead.status === 'CONVERTED') throw new SalesError('Bu aday müşteri zaten dönüştürülmüş.');
    if (lead.status === 'DISQUALIFIED') throw new SalesError('Kalifiye olmayan bir aday müşteri dönüştürülemez.');

    let partyId: string;
    if (input.existingPartyId) {
      const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.existingPartyId), eq(parties.companyId, companyId))).limit(1);
      if (!party) throw new SalesError('Eşleştirilecek cari kartı bulunamadı.');
      partyId = party.id;
    } else {
      partyId = await createPartyInTx(tx, companyId, userId, {
        legalName: lead.companyName || lead.contactName, roles: ['CUSTOMER'], email: lead.email, phone: lead.phone
      });
    }

    const opportunityId = await createOpportunityInTx(tx, companyId, userId, {
      partyId, leadId, name: input.opportunityName, estimatedValue: input.estimatedValue, currencyCode: input.currencyCode, expectedCloseDate: input.expectedCloseDate
    });

    await tx.update(leads).set({ status: 'CONVERTED', convertedPartyId: partyId }).where(eq(leads.id, leadId));

    return { partyId, opportunityId };
  });
}
