import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { machines, workCenters } from '@/db/schema';
import { newId } from '@/lib/id';
import { MesError } from './errors';

export interface CreateMachineInput {
  workCenterId: string;
  code: string;
  name: string;
  idealCycleTimeSeconds?: number;
}

export async function createMachine(companyId: string, input: CreateMachineInput): Promise<string> {
  const [workCenter] = await db.select({ id: workCenters.id }).from(workCenters).where(and(eq(workCenters.id, input.workCenterId), eq(workCenters.companyId, companyId))).limit(1);
  if (!workCenter) throw new MesError('İş merkezi bulunamadı.');

  const id = newId();
  await db.insert(machines).values({ id, companyId, workCenterId: input.workCenterId, code: input.code, name: input.name, idealCycleTimeSeconds: input.idealCycleTimeSeconds === undefined ? undefined : String(input.idealCycleTimeSeconds) });
  return id;
}

export async function listMachines(companyId: string) {
  return db
    .select({ id: machines.id, code: machines.code, name: machines.name, idealCycleTimeSeconds: machines.idealCycleTimeSeconds, workCenterId: machines.workCenterId, workCenterName: workCenters.name })
    .from(machines)
    .innerJoin(workCenters, eq(workCenters.id, machines.workCenterId))
    .where(and(eq(machines.companyId, companyId), eq(machines.active, true)));
}

export async function getMachine(companyId: string, machineId: string) {
  const [machine] = await db.select().from(machines).where(and(eq(machines.id, machineId), eq(machines.companyId, companyId))).limit(1);
  if (!machine) throw new MesError('Makine bulunamadı.');
  return machine;
}
