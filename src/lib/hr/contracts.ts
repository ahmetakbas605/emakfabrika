import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { employeeContracts, employees, EMPLOYEE_CONTRACT_TYPES } from '@/db/schema';
import { newId } from '@/lib/id';
import { HrError } from './errors';

// İK Faz 1 (İK Mimarisi raporu §12, Faz 1) — sözleşme versiyon zinciri.
// Bir çalışanın tek bir 'ACTIVE' sözleşmesi olur; yeni bir sözleşme
// (terfi/zam/yenileme) oluşturulduğunda öncekini SUPERSEDED'e çeviririz,
// SİLMEYİZ (madde 116-117 immutability ilkesi).

export interface CreateContractInput {
  contractType: (typeof EMPLOYEE_CONTRACT_TYPES)[number];
  startDate: string;
  endDate?: string;
  probationEndDate?: string;
  weeklyWorkingHours?: number;
  terms?: string;
}

async function requireEmployee(companyId: string, employeeId: string): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
}

export async function createEmployeeContract(companyId: string, employeeId: string, createdByUserId: string, input: CreateContractInput): Promise<string> {
  await requireEmployee(companyId, employeeId);

  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: employeeContracts.id, version: employeeContracts.version }).from(employeeContracts).where(and(eq(employeeContracts.employeeId, employeeId), eq(employeeContracts.status, 'ACTIVE'))).limit(1);
    if (current) await tx.update(employeeContracts).set({ status: 'SUPERSEDED' }).where(eq(employeeContracts.id, current.id));

    const id = newId();
    await tx.insert(employeeContracts).values({
      id, companyId, employeeId,
      contractType: input.contractType, status: 'ACTIVE',
      startDate: input.startDate, endDate: input.endDate, probationEndDate: input.probationEndDate,
      weeklyWorkingHours: input.weeklyWorkingHours !== undefined ? String(input.weeklyWorkingHours) : undefined,
      terms: input.terms,
      version: current ? current.version + 1 : 1,
      supersedesId: current?.id,
      createdByUserId
    });
    return id;
  });
}

export async function listEmployeeContracts(companyId: string, employeeId: string) {
  await requireEmployee(companyId, employeeId);
  return db.select().from(employeeContracts).where(eq(employeeContracts.employeeId, employeeId)).orderBy(desc(employeeContracts.version));
}
