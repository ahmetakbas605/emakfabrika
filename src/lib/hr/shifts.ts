import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { shifts, employees } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 2 (İK Mimarisi raporu §06) — vardiya tanımı, attendance
// processor'ın geç/erken-çıkış hesaplaması için gereken tek girdi.

export interface CreateShiftInput {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number;
  crossesMidnight?: boolean;
}

export async function createShift(companyId: string, input: CreateShiftInput): Promise<string> {
  const id = newId();
  await db.insert(shifts).values({
    id, companyId, code: input.code, name: input.name, startTime: input.startTime, endTime: input.endTime,
    breakMinutes: input.breakMinutes ?? 0, graceMinutes: input.graceMinutes ?? 0, crossesMidnight: input.crossesMidnight ?? false
  });
  return id;
}

export async function listShifts(companyId: string) {
  return db.select().from(shifts).where(and(eq(shifts.companyId, companyId), eq(shifts.active, true)));
}

export async function assignEmployeeShift(companyId: string, employeeId: string, shiftId: string | null): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  if (shiftId) {
    const [shift] = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.id, shiftId), eq(shifts.companyId, companyId))).limit(1);
    if (!shift) throw new HrError('Vardiya bulunamadı.');
  }

  await db.update(employees).set({ shiftId }).where(eq(employees.id, employeeId));
}
