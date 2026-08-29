import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { incidents, ticketIncidents, serviceDeskTickets, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// SERVICE-DESK.md §5 — bir incident birden fazla ticket'a bağlanabilir
// (madde 56: "20 ticket → 1 incident").
export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity?: (typeof incidents.$inferInsert)['severity'];
  openedByUserId: string;
}

export async function createIncident(companyId: string, input: CreateIncidentInput): Promise<string> {
  const id = newId();
  await db.insert(incidents).values({ id, companyId, title: input.title, description: input.description ?? '', severity: input.severity ?? 'MEDIUM', openedByUserId: input.openedByUserId });
  return id;
}

export async function listIncidents(companyId: string) {
  return db
    .select({ id: incidents.id, title: incidents.title, severity: incidents.severity, status: incidents.status, openedByName: users.fullName, createdAt: incidents.createdAt, resolvedAt: incidents.resolvedAt })
    .from(incidents)
    .innerJoin(users, eq(users.id, incidents.openedByUserId))
    .where(eq(incidents.companyId, companyId))
    .orderBy(desc(incidents.createdAt));
}

export async function linkTicketToIncident(companyId: string, ticketId: string, incidentId: string): Promise<void> {
  const [ticket] = await db.select({ id: serviceDeskTickets.id }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId))).limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');
  const [incident] = await db.select({ id: incidents.id }).from(incidents).where(and(eq(incidents.id, incidentId), eq(incidents.companyId, companyId))).limit(1);
  if (!incident) throw new ItError('Incident bulunamadı.');

  await db.insert(ticketIncidents).values({ ticketId, incidentId }).onDuplicateKeyUpdate({ set: { ticketId } });
}

export async function listIncidentTickets(incidentId: string) {
  return db
    .select({ id: serviceDeskTickets.id, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title, status: serviceDeskTickets.status })
    .from(ticketIncidents)
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, ticketIncidents.ticketId))
    .where(eq(ticketIncidents.incidentId, incidentId));
}

export async function changeIncidentStatus(companyId: string, incidentId: string, toStatus: (typeof incidents.$inferInsert)['status']): Promise<void> {
  await db.update(incidents).set({ status: toStatus, ...(toStatus === 'RESOLVED' || toStatus === 'CLOSED' ? { resolvedAt: new Date() } : {}) }).where(and(eq(incidents.id, incidentId), eq(incidents.companyId, companyId)));
}
