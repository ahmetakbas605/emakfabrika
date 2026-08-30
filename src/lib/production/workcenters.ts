import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { workCenters } from '@/db/schema';
import { newId } from '@/lib/id';

export interface CreateWorkCenterInput {
  code: string;
  name: string;
  capacityPerHour?: number;
}

export async function createWorkCenter(companyId: string, input: CreateWorkCenterInput): Promise<string> {
  const id = newId();
  await db.insert(workCenters).values({ id, companyId, code: input.code, name: input.name, capacityPerHour: input.capacityPerHour === undefined ? undefined : String(input.capacityPerHour) });
  return id;
}

export async function listWorkCenters(companyId: string) {
  return db.select().from(workCenters).where(and(eq(workCenters.companyId, companyId), eq(workCenters.active, true)));
}
