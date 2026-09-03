import 'server-only';
import { and, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  employees,
  occupationalHealthRecords,
  OCCUPATIONAL_HEALTH_EXAM_KINDS,
  OCCUPATIONAL_HEALTH_RECORD_TYPES,
  OCCUPATIONAL_HEALTH_RESULTS
} from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İşyeri Hekimi — Muayene / Sağlık Raporu / Periyodik Takip.
// lib/hr/qualifications.ts ile AYNI desen (tek tablo + tür ayrımı,
// süresi yaklaşanlar için ayrı sorgu).
//
// KVKK NOTU: bu tablodaki her satır ÖZEL NİTELİKLİ kişisel veridir.
// Bu dosya veriyi maskelemez — maskeleme/gizleme kararı ÇAĞIRAN
// tarafındadır (sayfa, access.permissions.view_sensitive'e bakar),
// maaş ve TC kimlik ile AYNI kural. Burada sadece şirket-kapsamı
// (companyId) zorlanır.

export type OccupationalHealthRecordType = (typeof OCCUPATIONAL_HEALTH_RECORD_TYPES)[number];
export type OccupationalHealthExamKind = (typeof OCCUPATIONAL_HEALTH_EXAM_KINDS)[number];
export type OccupationalHealthResult = (typeof OCCUPATIONAL_HEALTH_RESULTS)[number];

export interface CreateOccupationalHealthInput {
  employeeId: string;
  recordType: OccupationalHealthRecordType;
  examKind?: OccupationalHealthExamKind;
  title: string;
  physicianName?: string;
  institution?: string;
  performedAt?: string;
  nextDueDate?: string;
  result?: OccupationalHealthResult;
  restrictionNote?: string;
  notes?: string;
}

async function requireEmployee(companyId: string, employeeId: string): Promise<void> {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
    .limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
}

export async function createOccupationalHealthRecord(
  companyId: string,
  input: CreateOccupationalHealthInput
): Promise<string> {
  await requireEmployee(companyId, input.employeeId);

  // "Kısıtlı uygun" denip kısıtlamanın ne olduğu yazılmazsa kayıt
  // operasyonel olarak İŞE YARAMAZ — vardiya/görev ataması yapan kişi
  // neyi kısıtlayacağını bilemez. Bu yüzden zorunlu.
  if (input.result === 'FIT_WITH_RESTRICTION' && !input.restrictionNote?.trim()) {
    throw new HrError('Kısıtlı uygun kararı için kısıtlama açıklaması zorunludur.');
  }
  // Periyodik takip, tanımı gereği bir sonraki tarihi olan kayıttır.
  if (input.recordType === 'PERIODIC_FOLLOWUP' && !input.nextDueDate) {
    throw new HrError('Periyodik takip için sonraki tarih zorunludur.');
  }

  const id = newId();
  await db.insert(occupationalHealthRecords).values({
    id,
    companyId,
    employeeId: input.employeeId,
    recordType: input.recordType,
    examKind: input.examKind ?? 'OTHER',
    title: input.title,
    physicianName: input.physicianName ?? '',
    institution: input.institution ?? '',
    performedAt: input.performedAt,
    nextDueDate: input.nextDueDate,
    result: input.result ?? 'PENDING',
    restrictionNote: input.restrictionNote ?? '',
    notes: input.notes ?? ''
  });
  return id;
}

export async function listOccupationalHealthRecords(companyId: string, recordType?: OccupationalHealthRecordType) {
  const where = recordType
    ? and(eq(occupationalHealthRecords.companyId, companyId), eq(occupationalHealthRecords.recordType, recordType))
    : eq(occupationalHealthRecords.companyId, companyId);

  return db
    .select({
      id: occupationalHealthRecords.id,
      employeeId: occupationalHealthRecords.employeeId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      recordType: occupationalHealthRecords.recordType,
      examKind: occupationalHealthRecords.examKind,
      title: occupationalHealthRecords.title,
      physicianName: occupationalHealthRecords.physicianName,
      institution: occupationalHealthRecords.institution,
      performedAt: occupationalHealthRecords.performedAt,
      nextDueDate: occupationalHealthRecords.nextDueDate,
      result: occupationalHealthRecords.result,
      restrictionNote: occupationalHealthRecords.restrictionNote,
      notes: occupationalHealthRecords.notes,
      status: occupationalHealthRecords.status
    })
    .from(occupationalHealthRecords)
    .innerJoin(employees, eq(employees.id, occupationalHealthRecords.employeeId))
    .where(where)
    .orderBy(desc(occupationalHealthRecords.createdAt));
}

// Süresi gelen/geçen periyodik takipler. qualifications.ts'teki
// listExpiringQualifications ile AYNI mantık — gönderim altyapısı
// (e-posta/bildirim) burada da YOK, bu yalnızca sorgu.
export async function listDueOccupationalHealthRecords(companyId: string, withinDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return db
    .select({
      id: occupationalHealthRecords.id,
      employeeId: occupationalHealthRecords.employeeId,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      title: occupationalHealthRecords.title,
      recordType: occupationalHealthRecords.recordType,
      nextDueDate: occupationalHealthRecords.nextDueDate
    })
    .from(occupationalHealthRecords)
    .innerJoin(employees, eq(employees.id, occupationalHealthRecords.employeeId))
    .where(
      and(
        eq(occupationalHealthRecords.companyId, companyId),
        eq(occupationalHealthRecords.status, 'ACTIVE'),
        isNotNull(occupationalHealthRecords.nextDueDate),
        lte(occupationalHealthRecords.nextDueDate, cutoffStr)
      )
    )
    .orderBy(occupationalHealthRecords.nextDueDate);
}

export async function archiveOccupationalHealthRecord(companyId: string, recordId: string): Promise<void> {
  const [row] = await db
    .select({ id: occupationalHealthRecords.id })
    .from(occupationalHealthRecords)
    .where(and(eq(occupationalHealthRecords.id, recordId), eq(occupationalHealthRecords.companyId, companyId)))
    .limit(1);
  if (!row) throw new HrError('Kayıt bulunamadı.');
  await db.update(occupationalHealthRecords).set({ status: 'ARCHIVED' }).where(eq(occupationalHealthRecords.id, recordId));
}
