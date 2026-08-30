import 'server-only';
import { eq, and, gte, lt, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { pdksDevices, pdksRawPunches, pdksAttendanceRecords, employees, shifts, PDKS_ADAPTER_TYPES, PDKS_PUNCH_DIRECTIONS, PDKS_ATTENDANCE_STATUSES } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 2 (İK Mimarisi raporu §06) — akış: PDKS Cihazı → Integration
// Gateway (Adapter) → Raw Punch (silinmez) → Employee/Shift Eşleştirme →
// Attendance Kaydı. Bu dosyada cihaz entegrasyonu YOK — yalnızca MANUAL
// adaptör (recordManualPunch) ve işleme fonksiyonu (processAttendanceFor-
// Date) gerçek; gerçek donanım geldiğinde YENİ bir adapter dosyası
// recordManualPunch'ın attığı AYNI pdks_raw_punches satırını üretecek,
// bu dosyadaki hiçbir şey değişmeyecek (madde 170-172).

export interface CreateDeviceInput {
  code: string;
  name: string;
  adapterType?: (typeof PDKS_ADAPTER_TYPES)[number];
  branchId?: string;
}

export async function createDevice(companyId: string, input: CreateDeviceInput): Promise<string> {
  const id = newId();
  await db.insert(pdksDevices).values({ id, companyId, code: input.code, name: input.name, adapterType: input.adapterType ?? 'MANUAL', branchId: input.branchId });
  return id;
}

export async function listDevices(companyId: string) {
  return db.select().from(pdksDevices).where(and(eq(pdksDevices.companyId, companyId), eq(pdksDevices.active, true)));
}

export interface RecordManualPunchInput {
  deviceId: string;
  employeeId: string;
  punchAt: Date;
  direction: (typeof PDKS_PUNCH_DIRECTIONS)[number];
}

export async function recordManualPunch(companyId: string, recordedByUserId: string, input: RecordManualPunchInput): Promise<string> {
  const [device] = await db.select({ id: pdksDevices.id, adapterType: pdksDevices.adapterType }).from(pdksDevices).where(and(eq(pdksDevices.id, input.deviceId), eq(pdksDevices.companyId, companyId))).limit(1);
  if (!device) throw new HrError('Cihaz bulunamadı.');
  if (device.adapterType !== 'MANUAL') throw new HrError('Bu cihaz manuel giriş için yapılandırılmamış — yalnızca MANUAL tür cihazlar elle kayıt kabul eder.');
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  const id = newId();
  await db.insert(pdksRawPunches).values({ id, companyId, deviceId: input.deviceId, employeeId: input.employeeId, punchAt: input.punchAt, direction: input.direction, recordedByUserId });
  return id;
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

// madde 53/164'ün "Employee/Shift Eşleştirme → Attendance Kaydı" adımı —
// bir çalışan + bir takvim günü için o güne ait TÜM raw punch'ları
// okuyup TEK bir attendance satırına indirger (ilk giriş = check-in, son
// çıkış = check-out — basit ama gerçek bir eşleştirme algoritması; daha
// gelişmiş çoklu-mola senaryoları ileri bir faz).
export async function processAttendanceForDate(companyId: string, employeeId: string, workDate: string): Promise<string> {
  const [employee] = await db.select({ id: employees.id, shiftId: employees.shiftId }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  const shift = employee.shiftId ? (await db.select().from(shifts).where(eq(shifts.id, employee.shiftId)).limit(1))[0] : undefined;

  const dayStart = new Date(`${workDate}T00:00:00`);
  const dayEnd = new Date(`${workDate}T00:00:00`);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const punches = await db.select().from(pdksRawPunches).where(and(eq(pdksRawPunches.employeeId, employeeId), gte(pdksRawPunches.punchAt, dayStart), lt(pdksRawPunches.punchAt, dayEnd))).orderBy(asc(pdksRawPunches.punchAt));

  const checkInAt = punches.length > 0 ? punches[0].punchAt : null;
  const checkOutAt = punches.length > 1 ? punches[punches.length - 1].punchAt : null;

  let workedMinutes: number | null = null;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let status: (typeof PDKS_ATTENDANCE_STATUSES)[number];

  if (!checkInAt) {
    status = 'ABSENT';
  } else if (!checkOutAt) {
    status = 'INCOMPLETE';
  } else {
    workedMinutes = Math.max(0, diffMinutes(checkOutAt, checkInAt) - (shift?.breakMinutes ?? 0));
    if (shift) {
      const scheduledStart = new Date(`${workDate}T${shift.startTime}`);
      lateMinutes = Math.max(0, diffMinutes(checkInAt, scheduledStart) - shift.graceMinutes);

      const scheduledEnd = new Date(`${workDate}T${shift.endTime}`);
      if (shift.crossesMidnight || timeStringToMinutes(shift.endTime) <= timeStringToMinutes(shift.startTime)) scheduledEnd.setDate(scheduledEnd.getDate() + 1);
      earlyLeaveMinutes = Math.max(0, diffMinutes(scheduledEnd, checkOutAt));
    }
    status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
  }

  const id = newId();
  await db
    .insert(pdksAttendanceRecords)
    .values({ id, companyId, employeeId, workDate, shiftId: employee.shiftId, checkInAt, checkOutAt, workedMinutes, lateMinutes, earlyLeaveMinutes, status })
    .onDuplicateKeyUpdate({ set: { shiftId: employee.shiftId, checkInAt, checkOutAt, workedMinutes, lateMinutes, earlyLeaveMinutes, status } });

  if (punches.length > 0) {
    await db.update(pdksRawPunches).set({ processed: true }).where(and(eq(pdksRawPunches.employeeId, employeeId), gte(pdksRawPunches.punchAt, dayStart), lt(pdksRawPunches.punchAt, dayEnd)));
  }

  const [record] = await db.select({ id: pdksAttendanceRecords.id }).from(pdksAttendanceRecords).where(and(eq(pdksAttendanceRecords.employeeId, employeeId), eq(pdksAttendanceRecords.workDate, workDate))).limit(1);
  return record!.id;
}

export async function listAttendanceRecords(companyId: string, workDate: string) {
  return db
    .select({
      id: pdksAttendanceRecords.id, employeeId: pdksAttendanceRecords.employeeId,
      employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      workDate: pdksAttendanceRecords.workDate, checkInAt: pdksAttendanceRecords.checkInAt, checkOutAt: pdksAttendanceRecords.checkOutAt,
      workedMinutes: pdksAttendanceRecords.workedMinutes, lateMinutes: pdksAttendanceRecords.lateMinutes, earlyLeaveMinutes: pdksAttendanceRecords.earlyLeaveMinutes,
      status: pdksAttendanceRecords.status
    })
    .from(pdksAttendanceRecords)
    .innerJoin(employees, eq(employees.id, pdksAttendanceRecords.employeeId))
    .where(and(eq(pdksAttendanceRecords.companyId, companyId), eq(pdksAttendanceRecords.workDate, workDate)));
}

export async function listRawPunchesForDate(companyId: string, workDate: string) {
  const dayStart = new Date(`${workDate}T00:00:00`);
  const dayEnd = new Date(`${workDate}T00:00:00`);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return db
    .select({
      id: pdksRawPunches.id, employeeId: pdksRawPunches.employeeId, employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      deviceId: pdksRawPunches.deviceId, deviceName: pdksDevices.name, punchAt: pdksRawPunches.punchAt, direction: pdksRawPunches.direction, processed: pdksRawPunches.processed
    })
    .from(pdksRawPunches)
    .innerJoin(pdksDevices, eq(pdksDevices.id, pdksRawPunches.deviceId))
    .leftJoin(employees, eq(employees.id, pdksRawPunches.employeeId))
    .where(and(eq(pdksRawPunches.companyId, companyId), gte(pdksRawPunches.punchAt, dayStart), lt(pdksRawPunches.punchAt, dayEnd)))
    .orderBy(asc(pdksRawPunches.punchAt));
}
