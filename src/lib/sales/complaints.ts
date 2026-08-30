import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { customerComplaints, parties } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { SalesError } from './errors';

export interface CreateComplaintInput {
  partyId: string;
  orderId?: string;
  subject: string;
  description: string;
  priority?: (typeof customerComplaints.$inferInsert)['priority'];
  assignedToUserId?: string;
}

export async function createComplaint(companyId: string, createdByUserId: string, input: CreateComplaintInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [party] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, input.partyId), eq(parties.companyId, companyId))).limit(1);
    if (!party) throw new SalesError('Cari kartı bulunamadı.');

    const id = newId();
    const complaintNo = await nextDocumentNo(tx, companyId, 'CMPL', 'SKY', new Date().getFullYear(), 6);
    await tx.insert(customerComplaints).values({
      id, companyId, complaintNo, partyId: input.partyId, orderId: input.orderId, subject: input.subject, description: input.description,
      priority: input.priority ?? 'MEDIUM', assignedToUserId: input.assignedToUserId, createdByUserId
    });
    return id;
  });
}

export async function listComplaints(companyId: string, partyId?: string) {
  const conditions = partyId ? and(eq(customerComplaints.companyId, companyId), eq(customerComplaints.partyId, partyId)) : eq(customerComplaints.companyId, companyId);
  return db
    .select({ id: customerComplaints.id, complaintNo: customerComplaints.complaintNo, partyId: customerComplaints.partyId, partyName: parties.legalName, subject: customerComplaints.subject, status: customerComplaints.status, priority: customerComplaints.priority, createdAt: customerComplaints.createdAt })
    .from(customerComplaints)
    .innerJoin(parties, eq(parties.id, customerComplaints.partyId))
    .where(conditions)
    .orderBy(desc(customerComplaints.createdAt));
}

export async function getComplaint(companyId: string, complaintId: string) {
  const [row] = await db.select().from(customerComplaints).where(and(eq(customerComplaints.id, complaintId), eq(customerComplaints.companyId, companyId))).limit(1);
  if (!row) throw new SalesError('Şikayet bulunamadı.');
  return row;
}

export async function updateComplaintStatus(companyId: string, complaintId: string, status: (typeof customerComplaints.$inferInsert)['status']): Promise<void> {
  const complaint = await getComplaint(companyId, complaintId);
  if (complaint.status === 'CLOSED') throw new SalesError('Kapatılmış bir şikayetin durumu değiştirilemez.');
  await db.update(customerComplaints).set({ status }).where(eq(customerComplaints.id, complaintId));
}

export async function resolveComplaint(companyId: string, complaintId: string, resolutionNote: string): Promise<void> {
  const complaint = await getComplaint(companyId, complaintId);
  if (complaint.status === 'CLOSED') throw new SalesError('Zaten kapatılmış bir şikayet tekrar çözümlenemez.');
  await db.update(customerComplaints).set({ status: 'RESOLVED', resolutionNote, resolvedAt: new Date() }).where(eq(customerComplaints.id, complaintId));
}
