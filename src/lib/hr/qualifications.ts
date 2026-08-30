import 'server-only';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { employeeQualifications, employees, EMPLOYEE_QUALIFICATION_TYPES } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 1 (madde 16-22) — diploma/sertifika/eğitim TEK tabloda
// (qualificationType ile ayrışır). Belge dosyası document_attachments'a
// (entityType='EMPLOYEE_QUALIFICATION') ayrıca yüklenir.

export interface CreateQualificationInput {
  qualificationType: (typeof EMPLOYEE_QUALIFICATION_TYPES)[number];
  name: string;
  institution?: string;
  fieldOfStudy?: string;
  credentialNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

async function requireEmployee(companyId: string, employeeId: string): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
}

export async function createEmployeeQualification(companyId: string, employeeId: string, input: CreateQualificationInput): Promise<string> {
  await requireEmployee(companyId, employeeId);
  const id = newId();
  await db.insert(employeeQualifications).values({
    id, companyId, employeeId,
    qualificationType: input.qualificationType, name: input.name,
    institution: input.institution ?? '', fieldOfStudy: input.fieldOfStudy ?? '', credentialNumber: input.credentialNumber ?? '',
    issueDate: input.issueDate, expiryDate: input.expiryDate
  });
  return id;
}

export async function listEmployeeQualifications(companyId: string, employeeId: string) {
  await requireEmployee(companyId, employeeId);
  return db.select().from(employeeQualifications).where(eq(employeeQualifications.employeeId, employeeId));
}

export async function revokeEmployeeQualification(companyId: string, qualificationId: string): Promise<void> {
  const [row] = await db.select({ id: employeeQualifications.id }).from(employeeQualifications).where(and(eq(employeeQualifications.id, qualificationId), eq(employeeQualifications.companyId, companyId))).limit(1);
  if (!row) throw new HrError('Kayıt bulunamadı.');
  await db.update(employeeQualifications).set({ status: 'REVOKED' }).where(eq(employeeQualifications.id, qualificationId));
}

// Süre-dolma uyarısının VERİ modeli (İK Mimarisi raporu §05) — gönderim
// (e-posta/bildirim) altyapısı henüz yok (Faz 8), bu yalnızca sorgu.
export async function listExpiringQualifications(companyId: string, withinDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return db
    .select({
      id: employeeQualifications.id, employeeId: employeeQualifications.employeeId,
      employeeFirstName: employees.firstName, employeeLastName: employees.lastName,
      qualificationType: employeeQualifications.qualificationType, name: employeeQualifications.name, expiryDate: employeeQualifications.expiryDate
    })
    .from(employeeQualifications)
    .innerJoin(employees, eq(employees.id, employeeQualifications.employeeId))
    .where(and(eq(employeeQualifications.companyId, companyId), eq(employeeQualifications.status, 'ACTIVE'), isNotNull(employeeQualifications.expiryDate), lte(employeeQualifications.expiryDate, cutoffStr)));
}
