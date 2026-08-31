import 'server-only';
import { eq, and, isNotNull, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { prodOperations, machines, machineDowntimes } from '@/db/schema';
import { getMachine } from './machines';
import { MesError } from './errors';

// Holding ERP Faz 4 (MES) — OEE = Availability × Performance × Quality.
// SAKLANAN bir tablo DEĞİL — tamamen Faz 2'nin prod_operations'ından
// (started/completedAt, good/scrapQuantity) + bu fazın machine_downtimes'ından
// TALEP ÜZERİNE hesaplanan bir rapor (schema.ts'in kendi yorumu). Performance
// (dolayısıyla OEE) makinenin idealCycleTimeSeconds'ı BOŞSA hesaplanamaz —
// SESSİZCE 1.0/100% varsayılmaz, `null` döner ve UI bunu AÇIKÇA gösterir.

export interface OeeResult {
  operationId: string;
  totalTimeSeconds: number;
  downtimeSeconds: number;
  runTimeSeconds: number;
  availability: number;
  goodQuantity: number;
  scrapQuantity: number;
  totalOutput: number;
  quality: number;
  idealCycleTimeSeconds: number | null;
  performance: number | null;
  oee: number | null;
}

export async function getOeeForOperation(companyId: string, operationId: string): Promise<OeeResult> {
  const [op] = await db.select().from(prodOperations).where(and(eq(prodOperations.id, operationId), eq(prodOperations.companyId, companyId))).limit(1);
  if (!op) throw new MesError('Operasyon bulunamadı.');
  if (op.status !== 'COMPLETED' || !op.startedAt || !op.completedAt) throw new MesError('OEE yalnızca tamamlanmış (COMPLETED) operasyonlar için hesaplanabilir.');
  if (!op.machineId) throw new MesError('Bu operasyona bir makine atanmamış — OEE hesaplanamaz.');

  const machine = await getMachine(companyId, op.machineId);

  const totalTimeSeconds = (op.completedAt.getTime() - op.startedAt.getTime()) / 1000;

  const downtimes = await db
    .select({ startedAt: machineDowntimes.startedAt, endedAt: machineDowntimes.endedAt })
    .from(machineDowntimes)
    .where(and(eq(machineDowntimes.machineId, op.machineId), eq(machineDowntimes.operationId, operationId), isNotNull(machineDowntimes.endedAt)));

  // Duruş aralığı operasyon penceresinin [startedAt, completedAt] DIŞINA
  // taşarsa (nadiren olabilir — ör. duruş kaydı elle yanlış girildiyse)
  // yalnızca kesişen kısmı sayılır, savunmacı bir kırpma.
  let downtimeSeconds = 0;
  for (const d of downtimes) {
    const dStart = Math.max(d.startedAt.getTime(), op.startedAt.getTime());
    const dEnd = Math.min((d.endedAt as Date).getTime(), op.completedAt.getTime());
    if (dEnd > dStart) downtimeSeconds += (dEnd - dStart) / 1000;
  }

  const runTimeSeconds = Math.max(totalTimeSeconds - downtimeSeconds, 0);
  const availability = totalTimeSeconds > 0 ? runTimeSeconds / totalTimeSeconds : 0;

  const goodQuantity = Number(op.goodQuantity);
  const scrapQuantity = Number(op.scrapQuantity);
  const totalOutput = goodQuantity + scrapQuantity;
  const quality = totalOutput > 0 ? goodQuantity / totalOutput : 0;

  const idealCycleTimeSeconds = machine.idealCycleTimeSeconds ? Number(machine.idealCycleTimeSeconds) : null;
  const performance = idealCycleTimeSeconds !== null && runTimeSeconds > 0 ? (idealCycleTimeSeconds * totalOutput) / runTimeSeconds : null;
  const oee = performance !== null ? availability * performance * quality : null;

  return { operationId, totalTimeSeconds, downtimeSeconds, runTimeSeconds, availability, goodQuantity, scrapQuantity, totalOutput, quality, idealCycleTimeSeconds, performance, oee };
}

export interface MachineOeeSummary {
  machineId: string;
  operationCount: number;
  totalTimeSeconds: number;
  downtimeSeconds: number;
  runTimeSeconds: number;
  availability: number;
  goodQuantity: number;
  scrapQuantity: number;
  totalOutput: number;
  quality: number;
  idealCycleTimeSeconds: number | null;
  performance: number | null;
  oee: number | null;
}

// Bir makinenin bir tarih aralığındaki TÜM tamamlanmış operasyonlarını
// TEK bir birleşik OEE'ye toplar (madde 20'nin "performans/OEE" panel
// isteğinin gerçek karşılığı — tek bir operasyon değil, bir dönem).
export async function getMachineOeeSummary(companyId: string, machineId: string, fromDate: string, toDate: string): Promise<MachineOeeSummary> {
  const machine = await getMachine(companyId, machineId);
  const ops = await db
    .select({ id: prodOperations.id })
    .from(prodOperations)
    .where(and(eq(prodOperations.companyId, companyId), eq(prodOperations.machineId, machineId), eq(prodOperations.status, 'COMPLETED'), gte(prodOperations.completedAt, new Date(fromDate)), lte(prodOperations.completedAt, new Date(`${toDate}T23:59:59`))));

  let totalTimeSeconds = 0;
  let downtimeSeconds = 0;
  let goodQuantity = 0;
  let scrapQuantity = 0;
  for (const o of ops) {
    const result = await getOeeForOperation(companyId, o.id);
    totalTimeSeconds += result.totalTimeSeconds;
    downtimeSeconds += result.downtimeSeconds;
    goodQuantity += result.goodQuantity;
    scrapQuantity += result.scrapQuantity;
  }

  const runTimeSeconds = Math.max(totalTimeSeconds - downtimeSeconds, 0);
  const availability = totalTimeSeconds > 0 ? runTimeSeconds / totalTimeSeconds : 0;
  const totalOutput = goodQuantity + scrapQuantity;
  const quality = totalOutput > 0 ? goodQuantity / totalOutput : 0;
  const idealCycleTimeSeconds = machine.idealCycleTimeSeconds ? Number(machine.idealCycleTimeSeconds) : null;
  const performance = idealCycleTimeSeconds !== null && runTimeSeconds > 0 ? (idealCycleTimeSeconds * totalOutput) / runTimeSeconds : null;
  const oee = performance !== null ? availability * performance * quality : null;

  return { machineId, operationCount: ops.length, totalTimeSeconds, downtimeSeconds, runTimeSeconds, availability, goodQuantity, scrapQuantity, totalOutput, quality, idealCycleTimeSeconds, performance, oee };
}
