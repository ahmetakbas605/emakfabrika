import 'server-only';
import { eq, and, gte, lte, or, isNull, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { accessZones, accessGroups, accessGroupZones, accessGroupMembers, accessCards, accessLogs, pdksDevices, employees, ACCESS_CARD_STATUSES } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 4 (İK Mimarisi raporu §06, madde 84-88) — PDKS'in AYNI cihaz-
// adapter altyapısını (pdksDevices) paylaşan, ama kendi yetkilendirme
// kararını (GRANTED/DENIED) VEREN bir alt-domain. recordAccessAttempt,
// recordManualPunch (lib/hr/pdks.ts) İLE AYNI "yalnızca MANUAL adaptör"
// kısıtını taşır — gerçek donanım entegrasyonu bu fazın kapsamı DEĞİL.

export interface CreateZoneInput { code: string; name: string; branchId?: string; description?: string }
export async function createAccessZone(companyId: string, input: CreateZoneInput): Promise<string> {
  const id = newId();
  await db.insert(accessZones).values({ id, companyId, code: input.code, name: input.name, branchId: input.branchId, description: input.description ?? '' });
  return id;
}
export async function listAccessZones(companyId: string) {
  return db.select().from(accessZones).where(and(eq(accessZones.companyId, companyId), eq(accessZones.active, true)));
}

export interface CreateGroupInput { code: string; name: string; description?: string }
export async function createAccessGroup(companyId: string, input: CreateGroupInput): Promise<string> {
  const id = newId();
  await db.insert(accessGroups).values({ id, companyId, code: input.code, name: input.name, description: input.description ?? '' });
  return id;
}
export async function listAccessGroups(companyId: string) {
  return db.select().from(accessGroups).where(and(eq(accessGroups.companyId, companyId), eq(accessGroups.active, true)));
}

export async function addZoneToGroup(companyId: string, groupId: string, zoneId: string): Promise<void> {
  const [group] = await db.select({ id: accessGroups.id }).from(accessGroups).where(and(eq(accessGroups.id, groupId), eq(accessGroups.companyId, companyId))).limit(1);
  if (!group) throw new HrError('Erişim grubu bulunamadı.');
  const [zone] = await db.select({ id: accessZones.id }).from(accessZones).where(and(eq(accessZones.id, zoneId), eq(accessZones.companyId, companyId))).limit(1);
  if (!zone) throw new HrError('Erişim bölgesi bulunamadı.');

  const [existing] = await db.select({ id: accessGroupZones.id }).from(accessGroupZones).where(and(eq(accessGroupZones.groupId, groupId), eq(accessGroupZones.zoneId, zoneId))).limit(1);
  if (existing) return;
  await db.insert(accessGroupZones).values({ id: newId(), groupId, zoneId });
}

export async function listZonesForGroup(companyId: string, groupId: string) {
  return db
    .select({ id: accessZones.id, code: accessZones.code, name: accessZones.name })
    .from(accessGroupZones)
    .innerJoin(accessZones, eq(accessZones.id, accessGroupZones.zoneId))
    .where(and(eq(accessGroupZones.groupId, groupId), eq(accessZones.companyId, companyId)));
}

export interface AddGroupMemberInput { groupId: string; employeeId: string; validFrom?: string; validUntil?: string }
export async function addGroupMember(companyId: string, input: AddGroupMemberInput): Promise<string> {
  const [group] = await db.select({ id: accessGroups.id }).from(accessGroups).where(and(eq(accessGroups.id, input.groupId), eq(accessGroups.companyId, companyId))).limit(1);
  if (!group) throw new HrError('Erişim grubu bulunamadı.');
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  if (input.validFrom && input.validUntil && input.validFrom > input.validUntil) throw new HrError('Bitiş tarihi başlangıçtan önce olamaz.');

  const id = newId();
  await db.insert(accessGroupMembers).values({ id, companyId, groupId: input.groupId, employeeId: input.employeeId, validFrom: input.validFrom, validUntil: input.validUntil });
  return id;
}

export async function listGroupMembers(companyId: string, groupId: string) {
  return db
    .select({ id: accessGroupMembers.id, employeeId: accessGroupMembers.employeeId, firstName: employees.firstName, lastName: employees.lastName, validFrom: accessGroupMembers.validFrom, validUntil: accessGroupMembers.validUntil })
    .from(accessGroupMembers)
    .innerJoin(employees, eq(employees.id, accessGroupMembers.employeeId))
    .where(and(eq(accessGroupMembers.companyId, companyId), eq(accessGroupMembers.groupId, groupId)));
}

export async function issueCard(companyId: string, employeeId: string, cardNumber: string): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  const id = newId();
  await db.insert(accessCards).values({ id, companyId, employeeId, cardNumber });
  return id;
}

export async function setCardStatus(companyId: string, cardId: string, status: (typeof ACCESS_CARD_STATUSES)[number]): Promise<void> {
  const [card] = await db.select({ id: accessCards.id }).from(accessCards).where(and(eq(accessCards.id, cardId), eq(accessCards.companyId, companyId))).limit(1);
  if (!card) throw new HrError('Kart bulunamadı.');
  await db.update(accessCards).set({ status, revokedAt: status === 'ACTIVE' ? null : new Date() }).where(eq(accessCards.id, cardId));
}

export async function listCards(companyId: string) {
  return db
    .select({ id: accessCards.id, cardNumber: accessCards.cardNumber, status: accessCards.status, employeeId: accessCards.employeeId, firstName: employees.firstName, lastName: employees.lastName, issuedAt: accessCards.issuedAt })
    .from(accessCards)
    .innerJoin(employees, eq(employees.id, accessCards.employeeId))
    .where(eq(accessCards.companyId, companyId));
}

// madde 84-85 — bir çalışanın belirli bir andaki bir bölgeye erişim hakkı,
// üye olduğu (ve o an geçerli — validFrom/validUntil penceresi içinde
// olan) gruplardan HERHANGİ BİRİNİN o bölgeye grant'i varsa VAR sayılır.
export async function checkZoneAccess(companyId: string, employeeId: string, zoneId: string, at: Date): Promise<boolean> {
  const dateStr = at.toISOString().slice(0, 10);
  const memberships = await db
    .select({ groupId: accessGroupMembers.groupId })
    .from(accessGroupMembers)
    .where(and(
      eq(accessGroupMembers.companyId, companyId),
      eq(accessGroupMembers.employeeId, employeeId),
      or(isNull(accessGroupMembers.validFrom), lte(accessGroupMembers.validFrom, dateStr)),
      or(isNull(accessGroupMembers.validUntil), gte(accessGroupMembers.validUntil, dateStr))
    ));
  if (memberships.length === 0) return false;

  for (const m of memberships) {
    const [grant] = await db.select({ id: accessGroupZones.id }).from(accessGroupZones).where(and(eq(accessGroupZones.groupId, m.groupId), eq(accessGroupZones.zoneId, zoneId))).limit(1);
    if (grant) return true;
  }
  return false;
}

export interface RecordAccessAttemptInput {
  deviceId: string;
  zoneId: string;
  cardNumber: string;
  at?: Date;
}

export async function recordAccessAttempt(companyId: string, recordedByUserId: string, input: RecordAccessAttemptInput): Promise<{ id: string; result: 'GRANTED' | 'DENIED'; reason: string }> {
  const [device] = await db.select({ id: pdksDevices.id, adapterType: pdksDevices.adapterType }).from(pdksDevices).where(and(eq(pdksDevices.id, input.deviceId), eq(pdksDevices.companyId, companyId))).limit(1);
  if (!device) throw new HrError('Cihaz bulunamadı.');
  if (device.adapterType !== 'MANUAL') throw new HrError('Bu cihaz manuel giriş için yapılandırılmamış — yalnızca MANUAL tür cihazlar elle kayıt kabul eder.');
  const [zone] = await db.select({ id: accessZones.id }).from(accessZones).where(and(eq(accessZones.id, input.zoneId), eq(accessZones.companyId, companyId))).limit(1);
  if (!zone) throw new HrError('Erişim bölgesi bulunamadı.');

  const accessAt = input.at ?? new Date();
  const [card] = await db.select().from(accessCards).where(and(eq(accessCards.companyId, companyId), eq(accessCards.cardNumber, input.cardNumber))).limit(1);

  let result: 'GRANTED' | 'DENIED';
  let reason = '';
  let employeeId: string | null = null;
  let cardId: string | null = null;

  if (!card) {
    result = 'DENIED';
    reason = 'CARD_NOT_FOUND';
  } else {
    cardId = card.id;
    employeeId = card.employeeId;
    if (card.status !== 'ACTIVE') {
      result = 'DENIED';
      reason = `CARD_${card.status}`;
    } else {
      const granted = await checkZoneAccess(companyId, card.employeeId, input.zoneId, accessAt);
      result = granted ? 'GRANTED' : 'DENIED';
      reason = granted ? '' : 'NO_POLICY';
    }
  }

  const id = newId();
  await db.insert(accessLogs).values({ id, companyId, deviceId: input.deviceId, zoneId: input.zoneId, cardId, employeeId, accessAt, result, reason, recordedByUserId });
  return { id, result, reason };
}

export async function listAccessLogsForDate(companyId: string, workDate: string) {
  const dayStart = new Date(`${workDate}T00:00:00`);
  const dayEnd = new Date(`${workDate}T00:00:00`);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return db
    .select({
      id: accessLogs.id, accessAt: accessLogs.accessAt, result: accessLogs.result, reason: accessLogs.reason,
      zoneName: accessZones.name, employeeId: accessLogs.employeeId, firstName: employees.firstName, lastName: employees.lastName
    })
    .from(accessLogs)
    .innerJoin(accessZones, eq(accessZones.id, accessLogs.zoneId))
    .leftJoin(employees, eq(employees.id, accessLogs.employeeId))
    .where(and(eq(accessLogs.companyId, companyId), gte(accessLogs.accessAt, dayStart), lte(accessLogs.accessAt, dayEnd)))
    .orderBy(desc(accessLogs.accessAt));
}
