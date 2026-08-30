import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { employeeCompensations, employees } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 5 — maaş/ücret versiyon zinciri, employee_contracts (Faz 1) İLE
// BİREBİR AYNI ilke: yeni kayıt oluşturulduğunda önceki ACTIVE kayıt
// SUPERSEDED'e çevrilir, SİLİNMEZ. Onay akışı YOK (Faz 0'ın organizasyon
// değişikliği kararıyla AYNI — doğrudan İK düzenlemesi, Terfi/Transfer'in
// kendi onay akışı ileri bir faz).

export interface CreateCompensationInput {
  effectiveDate: string;
  baseSalary: number;
  currencyCode: string;
  changeReason?: string;
}

export async function createCompensation(companyId: string, employeeId: string, createdByUserId: string, input: CreateCompensationInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  if (input.baseSalary <= 0) throw new HrError('Maaş 0\'dan büyük olmalı.');

  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: employeeCompensations.id, version: employeeCompensations.version }).from(employeeCompensations).where(and(eq(employeeCompensations.employeeId, employeeId), eq(employeeCompensations.status, 'ACTIVE'))).limit(1);
    if (current) await tx.update(employeeCompensations).set({ status: 'SUPERSEDED' }).where(eq(employeeCompensations.id, current.id));

    const id = newId();
    await tx.insert(employeeCompensations).values({
      id, companyId, employeeId,
      effectiveDate: input.effectiveDate, baseSalary: String(input.baseSalary), currencyCode: input.currencyCode, changeReason: input.changeReason ?? '',
      version: current ? current.version + 1 : 1, supersedesId: current?.id, createdByUserId
    });
    return id;
  });
}

export async function listCompensationHistory(companyId: string, employeeId: string) {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  return db.select().from(employeeCompensations).where(eq(employeeCompensations.employeeId, employeeId)).orderBy(desc(employeeCompensations.version));
}

export async function getCurrentCompensation(companyId: string, employeeId: string) {
  const [row] = await db.select().from(employeeCompensations).where(and(eq(employeeCompensations.employeeId, employeeId), eq(employeeCompensations.companyId, companyId), eq(employeeCompensations.status, 'ACTIVE'))).limit(1);
  return row ?? null;
}
