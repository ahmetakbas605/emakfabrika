import 'server-only';
import { eq, and, lt, notInArray, desc, count } from 'drizzle-orm';
import { db } from '@/db/client';
import { serviceDeskTickets, slaPolicies, ticketEscalations, roles } from '@/db/schema';
import { newId } from '@/lib/id';

// SERVICE-DESK.md §8 — SLA süresi dolmuş ve bir escalation_chain'i olan
// ticket'lar için sıradaki seviyeye eskalasyon kaydı üretir. Gerçek bildirim
// altyapısı YOK (bkz. schema.ts:ticketEscalations'ın notu) — "eskalasyon"un
// bugünkü karşılığı: kalıcı denetim kaydı + arayüzde görünürlük.
const OPEN_STATUSES_EXCLUDED_FROM_ESCALATION = ['RESOLVED', 'USER_APPROVAL_PENDING', 'CLOSED'] as const;

export interface EscalationResult {
  escalatedCount: number;
}

export async function checkAndEscalateOverdueTickets(companyId: string): Promise<EscalationResult> {
  const now = new Date();

  const overdueTickets = await db
    .select({ id: serviceDeskTickets.id, slaPolicyId: serviceDeskTickets.slaPolicyId })
    .from(serviceDeskTickets)
    .where(and(
      eq(serviceDeskTickets.companyId, companyId),
      lt(serviceDeskTickets.slaDueAt, now),
      notInArray(serviceDeskTickets.status, [...OPEN_STATUSES_EXCLUDED_FROM_ESCALATION])
    ));

  let escalatedCount = 0;
  for (const ticket of overdueTickets) {
    if (!ticket.slaPolicyId) continue;
    const [policy] = await db.select({ escalationChain: slaPolicies.escalationChain }).from(slaPolicies).where(eq(slaPolicies.id, ticket.slaPolicyId)).limit(1);
    const chain = policy?.escalationChain;
    if (!chain || chain.length === 0) continue;

    const [{ value: currentLevel }] = await db.select({ value: count() }).from(ticketEscalations).where(eq(ticketEscalations.ticketId, ticket.id));
    if (currentLevel >= chain.length) continue; // zaten zincirin sonuna ulaşmış

    const nextRoleCode = chain[currentLevel];
    await db.insert(ticketEscalations).values({ id: newId(), ticketId: ticket.id, level: currentLevel + 1, escalatedToRoleCode: nextRoleCode });
    escalatedCount++;
  }

  return { escalatedCount };
}

export async function listTicketEscalations(ticketId: string) {
  return db
    .select({ id: ticketEscalations.id, level: ticketEscalations.level, escalatedToRoleCode: ticketEscalations.escalatedToRoleCode, roleName: roles.name, escalatedAt: ticketEscalations.escalatedAt })
    .from(ticketEscalations)
    .leftJoin(roles, eq(roles.code, ticketEscalations.escalatedToRoleCode))
    .where(eq(ticketEscalations.ticketId, ticketId))
    .orderBy(desc(ticketEscalations.level));
}

// Ticket listesinde "eskalasyon var mı" göstergesi için — tek tek sorgu
// yerine toplu bir map döner.
export async function getLatestEscalationLevels(companyId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ ticketId: ticketEscalations.ticketId, level: ticketEscalations.level })
    .from(ticketEscalations)
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, ticketEscalations.ticketId))
    .where(eq(serviceDeskTickets.companyId, companyId));

  const map = new Map<string, number>();
  for (const row of rows) {
    const existing = map.get(row.ticketId) ?? 0;
    if (row.level > existing) map.set(row.ticketId, row.level);
  }
  return map;
}

// SLA politikası formundaki bir eskalasyon zinciri metnini ("SERVICE_DESK_AGENT,
// IT_MANAGER") gerçek rol kodlarına göre doğrular — yazım hatasıyla var
// olmayan bir role eskalasyon YAPILANDIRILMASIN diye.
export async function validateEscalationChain(chain: string[]): Promise<string | null> {
  if (chain.length === 0) return null;
  const existingRoles = await db.select({ code: roles.code }).from(roles);
  const existingCodes = new Set(existingRoles.map((r) => r.code));
  const unknown = chain.find((c) => !existingCodes.has(c));
  return unknown ? `Bilinmeyen rol kodu: ${unknown}` : null;
}
