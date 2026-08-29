import 'server-only';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import type { Tx } from '@/db/client';
import {
  serviceDeskTickets, ticketStatusHistory, ticketAssignments, ticketComments, ticketWorkLogs,
  ticketNumberCounters, slaPolicies, users, itAssets, TICKET_STATUSES, TICKET_PRIORITIES
} from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// SERVICE-DESK.md §1 — geçerli geçiş tablosu, checks.ts (RECEIVED_TRANSITIONS/
// ISSUED_TRANSITIONS) İLE AYNI desen: tanımsız geçiş reddedilir.
// CLOSED: [] bilinçli — CLOSED'dan çıkış SADECE reopenTicket() ile, farklı
// bir kod yolundan (madde 207: "rastgele yapılamaz").
export const TICKET_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED'],
  TRIAGED: ['ASSIGNED'],
  ASSIGNED: ['ACCEPTED', 'ON_THE_WAY'],
  ACCEPTED: ['ON_THE_WAY', 'WORKING'],
  ON_THE_WAY: ['ARRIVED'],
  ARRIVED: ['INSPECTION'],
  INSPECTION: ['WORKING'],
  WORKING: ['WAITING', 'TESTING'],
  WAITING: ['WORKING'],
  TESTING: ['RESOLVED', 'WORKING'],
  RESOLVED: ['USER_APPROVAL_PENDING'],
  USER_APPROVAL_PENDING: ['CLOSED', 'WORKING'],
  CLOSED: []
};

async function nextTicketNo(tx: Tx, companyId: string, year: number): Promise<string> {
  await tx.insert(ticketNumberCounters).values({ companyId, year, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
  await tx.update(ticketNumberCounters).set({ lastNumber: sql`${ticketNumberCounters.lastNumber} + 1` }).where(and(eq(ticketNumberCounters.companyId, companyId), eq(ticketNumberCounters.year, year)));
  const [row] = await tx.select({ lastNumber: ticketNumberCounters.lastNumber }).from(ticketNumberCounters).where(and(eq(ticketNumberCounters.companyId, companyId), eq(ticketNumberCounters.year, year))).limit(1);
  return `TK${year}${String(row.lastNumber).padStart(6, '0')}`;
}

// SERVICE-DESK.md §2 — business_hours/holiday_calendars ayarlaması bilinçli
// olarak YOK bugün (TODO: SLA_AFTER_HOURS_POLICY, BUSINESS_REVIEW). Yalnızca
// createdAt + policy süresi.
export function resolveSlaDeadline(createdAt: Date, policy: { responseMinutes: number; resolutionHours: number }): Date {
  return new Date(createdAt.getTime() + policy.resolutionHours * 60 * 60 * 1000);
}

export interface CreateTicketInput {
  title: string;
  description?: string;
  category?: string;
  priority?: (typeof serviceDeskTickets.$inferInsert)['priority'];
  ticketType?: (typeof serviceDeskTickets.$inferInsert)['ticketType'];
  requestedByUserId: string;
  relatedAssetId?: string;
  relatedCiId?: string;
}

// lib/accounting.ts:postJournal/postJournalInTx İLE AYNI desen — maintenance
// gibi kendi transaction'ı İÇİNDE bir ticket açması gereken çağıranlar
// (lib/it/maintenance.ts:generateOneWorkOrder) bu iç fonksiyonu kullanır,
// AKSİ HALDE db.transaction içinden AYRI bir db.transaction çağrısı gerçek
// bir iç içe geçme OLMAZ (yeni/ayrı bir bağlantı açar) ve dış transaction
// geri alındığında ticket geri alınmaz — atomiklik kırılır.
export async function createTicketInTx(tx: Tx, companyId: string, departmentId: string, input: CreateTicketInput): Promise<string> {
  const id = newId();
  const now = new Date();
  const year = now.getFullYear();
  const priority = input.priority ?? 'NORMAL';

  const ticketNo = await nextTicketNo(tx, companyId, year);

  const [policy] = await tx.select().from(slaPolicies).where(and(eq(slaPolicies.companyId, companyId), eq(slaPolicies.priority, priority), eq(slaPolicies.active, true))).limit(1);
  const slaDueAt = policy ? resolveSlaDeadline(now, policy) : null;

  await tx.insert(serviceDeskTickets).values({
    id, companyId, departmentId, ticketNo, ticketType: input.ticketType ?? 'STANDARD', title: input.title, description: input.description ?? '',
    category: input.category ?? '', priority, status: 'NEW', requestedByUserId: input.requestedByUserId,
    relatedAssetId: input.relatedAssetId, relatedCiId: input.relatedCiId,
    slaPolicyId: policy?.id, slaDueAt
  });
  return id;
}

export async function createTicket(companyId: string, departmentId: string, input: CreateTicketInput): Promise<string> {
  return db.transaction((tx) => createTicketInTx(tx, companyId, departmentId, input));
}

export async function listTickets(companyId: string, filter?: { status?: string; priority?: string }) {
  const conditions = [eq(serviceDeskTickets.companyId, companyId)];
  if (filter?.status) conditions.push(eq(serviceDeskTickets.status, filter.status as (typeof TICKET_STATUSES)[number]));
  if (filter?.priority) conditions.push(eq(serviceDeskTickets.priority, filter.priority as (typeof TICKET_PRIORITIES)[number]));

  return db
    .select({
      id: serviceDeskTickets.id, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title,
      category: serviceDeskTickets.category, priority: serviceDeskTickets.priority, status: serviceDeskTickets.status,
      requestedByName: users.fullName, slaDueAt: serviceDeskTickets.slaDueAt, createdAt: serviceDeskTickets.createdAt,
      relatedAssetTag: itAssets.assetTag
    })
    .from(serviceDeskTickets)
    .innerJoin(users, eq(users.id, serviceDeskTickets.requestedByUserId))
    .leftJoin(itAssets, eq(itAssets.id, serviceDeskTickets.relatedAssetId))
    .where(and(...conditions))
    .orderBy(desc(serviceDeskTickets.createdAt));
}

export async function getTicket(companyId: string, ticketId: string) {
  const [row] = await db
    .select({
      id: serviceDeskTickets.id, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title,
      description: serviceDeskTickets.description, category: serviceDeskTickets.category,
      priority: serviceDeskTickets.priority, status: serviceDeskTickets.status,
      requestedByUserId: serviceDeskTickets.requestedByUserId, requestedByName: users.fullName,
      relatedAssetId: serviceDeskTickets.relatedAssetId, relatedCiId: serviceDeskTickets.relatedCiId,
      slaDueAt: serviceDeskTickets.slaDueAt, createdAt: serviceDeskTickets.createdAt, closedAt: serviceDeskTickets.closedAt
    })
    .from(serviceDeskTickets)
    .innerJoin(users, eq(users.id, serviceDeskTickets.requestedByUserId))
    .where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId)))
    .limit(1);
  if (!row) throw new ItError('Ticket bulunamadı.');
  return row;
}

// SERVICE-DESK.md §1 — TICKET_TRANSITIONS'ta tanımlı olmayan geçiş reddedilir.
// CLOSED buradan ASLA çıkamaz (reopenTicket ayrı, farklı bir fonksiyon).
export async function transitionTicket(companyId: string, ticketId: string, toStatus: string, changedBy: string, note?: string): Promise<void> {
  const [ticket] = await db.select({ status: serviceDeskTickets.status }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId))).limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');

  const allowed = TICKET_TRANSITIONS[ticket.status] ?? [];
  if (!allowed.includes(toStatus)) throw new ItError(`${ticket.status} durumundan ${toStatus} durumuna geçilemez.`);

  await db.transaction(async (tx) => {
    await tx.update(serviceDeskTickets).set({ status: toStatus as (typeof serviceDeskTickets.$inferInsert)['status'], ...(toStatus === 'CLOSED' ? { closedAt: new Date() } : {}) }).where(eq(serviceDeskTickets.id, ticketId));
    await tx.insert(ticketStatusHistory).values({ id: newId(), ticketId, fromStatus: ticket.status, toStatus, changedBy, note });
  });
}

// SERVICE-DESK.md §1 — madde 207: CLOSED → WORKING rastgele yapılamaz, bu
// AYRI kod yolu (çağıran actions/it/tickets.ts'te requireDepartmentAccess(
// deptId, 'approve') ile korunuyor — lib katmanı izin kontrolü YAPMAZ, tüm
// projede tutarlı desen, bkz. lib/accounting.ts:reopenPeriod).
export async function reopenTicket(companyId: string, ticketId: string, changedBy: string, note?: string): Promise<void> {
  const [ticket] = await db.select({ status: serviceDeskTickets.status }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId))).limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');
  if (ticket.status !== 'CLOSED') throw new ItError('Yalnızca kapalı bir ticket yeniden açılabilir.');

  await db.transaction(async (tx) => {
    await tx.update(serviceDeskTickets).set({ status: 'WORKING', closedAt: null }).where(eq(serviceDeskTickets.id, ticketId));
    await tx.insert(ticketStatusHistory).values({ id: newId(), ticketId, fromStatus: 'CLOSED', toStatus: 'WORKING', changedBy, note: note ?? 'Yeniden açıldı.' });
  });
}

// SERVICE-DESK.md §4 — tam olarak BİR aktif LEADER zorunlu. it_asset_
// assignments İLE AYNI desen: yeni LEADER atanınca öncekinin unassignedAt'ı
// kapatılır (WHERE unassignedAt IS NULL ZORUNLU — lib/it/assets.ts'teki
// assignAsset bug'ıyla AYNI derste, bu yüzden burada baştan doğru).
export async function assignTicket(companyId: string, ticketId: string, userId: string, role: 'LEADER' | 'MEMBER', assignedBy: string): Promise<void> {
  const [ticket] = await db.select({ id: serviceDeskTickets.id, status: serviceDeskTickets.status }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId))).limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');

  await db.transaction(async (tx) => {
    if (role === 'LEADER') {
      await tx.update(ticketAssignments).set({ unassignedAt: new Date() }).where(and(eq(ticketAssignments.ticketId, ticketId), eq(ticketAssignments.role, 'LEADER'), isNull(ticketAssignments.unassignedAt)));
    }
    await tx.insert(ticketAssignments).values({ id: newId(), ticketId, userId, role, assignedBy });
    if (ticket.status === 'NEW' || ticket.status === 'TRIAGED') {
      await tx.update(serviceDeskTickets).set({ status: 'ASSIGNED' }).where(eq(serviceDeskTickets.id, ticketId));
      await tx.insert(ticketStatusHistory).values({ id: newId(), ticketId, fromStatus: ticket.status, toStatus: 'ASSIGNED', changedBy: assignedBy, note: 'Atama yapıldı.' });
    }
  });
}

export async function listTicketAssignments(ticketId: string) {
  return db
    .select({ id: ticketAssignments.id, userId: ticketAssignments.userId, userName: users.fullName, role: ticketAssignments.role, assignedAt: ticketAssignments.assignedAt, unassignedAt: ticketAssignments.unassignedAt })
    .from(ticketAssignments)
    .innerJoin(users, eq(users.id, ticketAssignments.userId))
    .where(eq(ticketAssignments.ticketId, ticketId))
    .orderBy(desc(ticketAssignments.assignedAt));
}

export async function addComment(ticketId: string, authorUserId: string, body: string, isInternal: boolean): Promise<void> {
  await db.insert(ticketComments).values({ id: newId(), ticketId, authorUserId, body, isInternal });
}

export async function logWork(ticketId: string, userId: string, minutesSpent: number, note?: string): Promise<void> {
  if (minutesSpent <= 0) throw new ItError('Harcanan süre 0dan büyük olmalı.');
  await db.insert(ticketWorkLogs).values({ id: newId(), ticketId, userId, minutesSpent, note });
}

export type TimelineEntry =
  | { kind: 'STATUS_CHANGE'; at: Date; fromStatus: string; toStatus: string; byName: string; note: string | null }
  | { kind: 'COMMENT'; at: Date; byName: string; body: string; isInternal: boolean }
  | { kind: 'WORK_LOG'; at: Date; byName: string; minutesSpent: number; note: string | null };

// SERVICE-DESK.md §7 — ayrı bir timeline tablosu YOK, üç kaynak BİRLEŞTİRİLİP
// (uygulama katmanında) zamana göre sıralanıyor.
export async function getTicketTimeline(ticketId: string): Promise<TimelineEntry[]> {
  const [statusRows, commentRows, workLogRows] = await Promise.all([
    db.select({ at: ticketStatusHistory.createdAt, fromStatus: ticketStatusHistory.fromStatus, toStatus: ticketStatusHistory.toStatus, byName: users.fullName, note: ticketStatusHistory.note })
      .from(ticketStatusHistory).innerJoin(users, eq(users.id, ticketStatusHistory.changedBy)).where(eq(ticketStatusHistory.ticketId, ticketId)),
    db.select({ at: ticketComments.createdAt, byName: users.fullName, body: ticketComments.body, isInternal: ticketComments.isInternal })
      .from(ticketComments).innerJoin(users, eq(users.id, ticketComments.authorUserId)).where(eq(ticketComments.ticketId, ticketId)),
    db.select({ at: ticketWorkLogs.loggedAt, byName: users.fullName, minutesSpent: ticketWorkLogs.minutesSpent, note: ticketWorkLogs.note })
      .from(ticketWorkLogs).innerJoin(users, eq(users.id, ticketWorkLogs.userId)).where(eq(ticketWorkLogs.ticketId, ticketId))
  ]);

  const entries: TimelineEntry[] = [
    ...statusRows.map((r): TimelineEntry => ({ kind: 'STATUS_CHANGE', at: r.at, fromStatus: r.fromStatus, toStatus: r.toStatus, byName: r.byName, note: r.note })),
    ...commentRows.map((r): TimelineEntry => ({ kind: 'COMMENT', at: r.at, byName: r.byName, body: r.body, isInternal: r.isInternal })),
    ...workLogRows.map((r): TimelineEntry => ({ kind: 'WORK_LOG', at: r.at, byName: r.byName, minutesSpent: r.minutesSpent, note: r.note }))
  ];
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function listSlaPolicies(companyId: string) {
  return db.select().from(slaPolicies).where(eq(slaPolicies.companyId, companyId));
}

export interface CreateSlaPolicyInput {
  name: string;
  priority: (typeof slaPolicies.$inferInsert)['priority'];
  responseMinutes: number;
  resolutionHours: number;
}

export async function createSlaPolicy(companyId: string, input: CreateSlaPolicyInput): Promise<string> {
  const id = newId();
  await db.insert(slaPolicies).values({ id, companyId, ...input });
  return id;
}
