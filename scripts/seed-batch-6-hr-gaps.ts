// İK eksikleri: İzin Hakkı, İzin Talebi, Fazla Mesai, Prim/Bonus, PDKS
// (cihaz + ham okuma + günlük yoklama kaydı).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  employees, users, branches,
  leaveEntitlements, leaveRequests, overtimeRequests, bonusRequests,
  shifts, pdksDevices, pdksRawPunches, pdksAttendanceRecords
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const empRows = await db.select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(eq(employees.companyId, COMPANY_ID)).limit(6);
    const [merve] = empRows.filter((e) => e.firstName === 'Merve');
    const [yusuf] = empRows.filter((e) => e.firstName === 'Yusuf');
    const [ali] = empRows.filter((e) => e.firstName === 'Ali');
    const [fatma] = empRows.filter((e) => e.firstName === 'Fatma');
    const sampleEmployees = [merve, yusuf, ali, fatma].filter(Boolean);

    // ================= İZİN HAKKI (yıllık, her çalışana) =================
    const existingEnt = await db.select({ employeeId: leaveEntitlements.employeeId }).from(leaveEntitlements).where(and(eq(leaveEntitlements.companyId, COMPANY_ID), eq(leaveEntitlements.year, 2026)));
    const existingEntEmp = new Set(existingEnt.map((e) => e.employeeId));
    const allEmp = await db.select({ id: employees.id }).from(employees).where(eq(employees.companyId, COMPANY_ID));
    const entToAdd = allEmp.filter((e) => !existingEntEmp.has(e.id));
    if (entToAdd.length > 0) {
      await db.insert(leaveEntitlements).values(entToAdd.map((e) => ({ id: id(), companyId: COMPANY_ID, employeeId: e.id, year: 2026, leaveType: 'ANNUAL' as const, entitlementDays: '14.00' })));
    }
    console.log(`İzin hakkı: ${entToAdd.length} çalışana yıllık izin hakkı tanımlandı.`);

    // ================= İZİN TALEBİ =================
    const existingLeave = await db.select({ leaveNo: leaveRequests.leaveNo }).from(leaveRequests).where(eq(leaveRequests.companyId, COMPANY_ID));
    if (!existingLeave.some((l) => l.leaveNo === 'IZN20260001') && merve) {
      await db.insert(leaveRequests).values({ id: id(), companyId: COMPANY_ID, leaveNo: 'IZN20260001', employeeId: merve.id, leaveType: 'ANNUAL', startDate: '2026-09-10', endDate: '2026-09-14', dayCount: '5.00', reason: 'Yıllık izin.', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-09-01'), completedAt: new Date('2026-09-02') });
    }
    if (!existingLeave.some((l) => l.leaveNo === 'IZN20260002') && yusuf) {
      await db.insert(leaveRequests).values({ id: id(), companyId: COMPANY_ID, leaveNo: 'IZN20260002', employeeId: yusuf.id, leaveType: 'SICK', startDate: '2026-09-15', endDate: '2026-09-16', dayCount: '2.00', reason: 'Rapor.', status: 'SUBMITTED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-09-14') });
    }
    console.log('İzin talebi: 2 örnek (biri onaylı, biri onay bekliyor).');

    // ================= FAZLA MESAİ =================
    const existingOt = await db.select({ overtimeNo: overtimeRequests.overtimeNo }).from(overtimeRequests).where(eq(overtimeRequests.companyId, COMPANY_ID));
    if (!existingOt.some((o) => o.overtimeNo === 'FMS20260001') && ali) {
      await db.insert(overtimeRequests).values({ id: id(), companyId: COMPANY_ID, overtimeNo: 'FMS20260001', employeeId: ali.id, workDate: '2026-09-01', hours: '3.50', reason: 'Ay sonu envanter sayımı.', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-09-01'), completedAt: new Date('2026-09-02') });
    }
    console.log('Fazla mesai: 1 örnek (onaylı).');

    // ================= BONUS/PRİM =================
    const existingBonus = await db.select({ bonusNo: bonusRequests.bonusNo }).from(bonusRequests).where(eq(bonusRequests.companyId, COMPANY_ID));
    if (!existingBonus.some((b) => b.bonusNo === 'PRM20260001') && fatma) {
      await db.insert(bonusRequests).values({ id: id(), companyId: COMPANY_ID, bonusNo: 'PRM20260001', employeeId: fatma.id, bonusType: 'PERFORMANCE', amount: '7500.00', currencyCode: 'TRY', reason: 'Q3 performans primi.', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-09-01'), completedAt: new Date('2026-09-03') });
    }
    console.log('Prim: 1 örnek (onaylı).');

    // ================= PDKS =================
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.companyId, COMPANY_ID));
    const existingDevices = await db.select({ code: pdksDevices.code }).from(pdksDevices).where(eq(pdksDevices.companyId, COMPANY_ID));
    let deviceId: string;
    if (!existingDevices.some((d) => d.code === 'PDKS-01')) {
      deviceId = id();
      await db.insert(pdksDevices).values({ id: deviceId, companyId: COMPANY_ID, code: 'PDKS-01', name: 'Fabrika Ana Giriş Turnikesi', adapterType: 'GENERIC_RFID', branchId: branch?.id });
      console.log('PDKS: 1 cihaz eklendi.');
    } else {
      const [existing] = await db.select({ id: pdksDevices.id }).from(pdksDevices).where(and(eq(pdksDevices.companyId, COMPANY_ID), eq(pdksDevices.code, 'PDKS-01')));
      deviceId = existing.id;
    }

    const [shiftGunduz] = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.companyId, COMPANY_ID), eq(shifts.code, 'GUNDUZ')));

    if (ali) {
      const existingPunch = await db.select().from(pdksRawPunches).where(and(eq(pdksRawPunches.employeeId, ali.id), eq(pdksRawPunches.deviceId, deviceId)));
      if (existingPunch.length === 0) {
        await db.insert(pdksRawPunches).values([
          { id: id(), companyId: COMPANY_ID, deviceId, employeeId: ali.id, punchAt: new Date('2026-09-01T08:05:00'), direction: 'IN', processed: true, recordedByUserId: ADMIN_USER_ID },
          { id: id(), companyId: COMPANY_ID, deviceId, employeeId: ali.id, punchAt: new Date('2026-09-01T17:10:00'), direction: 'OUT', processed: true, recordedByUserId: ADMIN_USER_ID }
        ]);
      }
      const existingAtt = await db.select().from(pdksAttendanceRecords).where(and(eq(pdksAttendanceRecords.employeeId, ali.id), eq(pdksAttendanceRecords.workDate, '2026-09-01')));
      if (existingAtt.length === 0 && shiftGunduz) {
        await db.insert(pdksAttendanceRecords).values({ id: id(), companyId: COMPANY_ID, employeeId: ali.id, workDate: '2026-09-01', shiftId: shiftGunduz.id, checkInAt: new Date('2026-09-01T08:05:00'), checkOutAt: new Date('2026-09-01T17:10:00'), workedMinutes: 485, lateMinutes: 5, status: 'LATE' });
      }
      console.log('PDKS: 2 ham okuma + 1 günlük yoklama kaydı eklendi.');
    }

    console.log('\n=== BATCH 6 (İK eksikleri) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 6 başarısız:', err); process.exit(1); });
