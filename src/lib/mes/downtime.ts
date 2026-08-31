import 'server-only';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { machineDowntimes, machines, downtimeReasons } from '@/db/schema';
import { newId } from '@/lib/id';
import { MesError } from './errors';

// Holding ERP Faz 4 (MES) — Duruş (Downtime) kayıtları. OEE'nin
// Availability bileşenini besleyen tek gerçek veri kaynağı (lib/mes/oee.ts).
// Bu fonksiyonlar bir insanın UI'dan tıklamasıyla da, gelecekte bir PLC/
// OPC-UA köprüsünün programatik çağrısıyla da AYNI şekilde çalışır — madde
// 21'in "entegrasyona hazır API" isteğinin GERÇEK karşılığı bu (ayrı bir
// event-bus soyutlaması icat edilmedi).

export interface RecordDowntimeStartInput {
  machineId: string;
  operationId?: string;
  reasonCode: string;
  startedAt?: string; // verilmezse şu an
  notes?: string;
}

export async function recordDowntimeStart(companyId: string, userId: string, input: RecordDowntimeStartInput): Promise<string> {
  const [machine] = await db.select({ id: machines.id }).from(machines).where(and(eq(machines.id, input.machineId), eq(machines.companyId, companyId))).limit(1);
  if (!machine) throw new MesError('Makine bulunamadı.');
  const [reason] = await db.select({ code: downtimeReasons.code }).from(downtimeReasons).where(eq(downtimeReasons.code, input.reasonCode)).limit(1);
  if (!reason) throw new MesError('Duruş nedeni bulunamadı.');

  const [alreadyOpen] = await db.select({ id: machineDowntimes.id }).from(machineDowntimes).where(and(eq(machineDowntimes.machineId, input.machineId), isNull(machineDowntimes.endedAt))).limit(1);
  if (alreadyOpen) throw new MesError('Bu makine için zaten açık (devam eden) bir duruş var — önce onu kapatın.');

  const id = newId();
  await db.insert(machineDowntimes).values({
    id, companyId, machineId: input.machineId, operationId: input.operationId, reasonCode: input.reasonCode,
    startedAt: input.startedAt ? new Date(input.startedAt) : new Date(), notes: input.notes, recordedByUserId: userId
  });
  return id;
}

export async function recordDowntimeEnd(companyId: string, downtimeId: string, endedAt?: string): Promise<void> {
  const [downtime] = await db.select().from(machineDowntimes).where(and(eq(machineDowntimes.id, downtimeId), eq(machineDowntimes.companyId, companyId))).limit(1);
  if (!downtime) throw new MesError('Duruş kaydı bulunamadı.');
  if (downtime.endedAt) throw new MesError('Bu duruş zaten kapatılmış.');
  const end = endedAt ? new Date(endedAt) : new Date();
  if (end < downtime.startedAt) throw new MesError('Bitiş zamanı başlangıçtan önce olamaz.');
  await db.update(machineDowntimes).set({ endedAt: end }).where(eq(machineDowntimes.id, downtimeId));
}

export async function listDowntimeReasons() {
  return db.select().from(downtimeReasons);
}

export async function listMachineDowntimes(companyId: string, machineId?: string) {
  const conditions = machineId ? and(eq(machineDowntimes.companyId, companyId), eq(machineDowntimes.machineId, machineId)) : eq(machineDowntimes.companyId, companyId);
  return db
    .select({
      id: machineDowntimes.id, machineId: machineDowntimes.machineId, machineName: machines.name, operationId: machineDowntimes.operationId,
      reasonCode: machineDowntimes.reasonCode, reasonName: downtimeReasons.name, category: downtimeReasons.category,
      startedAt: machineDowntimes.startedAt, endedAt: machineDowntimes.endedAt, notes: machineDowntimes.notes
    })
    .from(machineDowntimes)
    .innerJoin(machines, eq(machines.id, machineDowntimes.machineId))
    .innerJoin(downtimeReasons, eq(downtimeReasons.code, machineDowntimes.reasonCode))
    .where(conditions)
    .orderBy(desc(machineDowntimes.startedAt));
}

export async function listOpenDowntimes(companyId: string) {
  return db
    .select({ id: machineDowntimes.id, machineId: machineDowntimes.machineId, machineName: machines.name, reasonName: downtimeReasons.name, startedAt: machineDowntimes.startedAt })
    .from(machineDowntimes)
    .innerJoin(machines, eq(machines.id, machineDowntimes.machineId))
    .innerJoin(downtimeReasons, eq(downtimeReasons.code, machineDowntimes.reasonCode))
    .where(and(eq(machineDowntimes.companyId, companyId), isNull(machineDowntimes.endedAt)));
}
