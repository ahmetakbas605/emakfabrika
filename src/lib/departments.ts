import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { departments, departmentTypes } from '@/db/schema';
import { newId } from '@/lib/id';
import { CoreError } from '@/lib/core/errors';

export interface DepartmentSummary {
  id: string;
  departmentTypeCode: string;
  name: string;
  parentDepartmentId: string | null;
}

// Fabrika yöneticisi hiçbir departmana açıkça atanmamış olsa bile HEPSİNİ
// görebilmeli (requireDepartmentAccess'teki fallback'in listeleme karşılığı).
export async function listCompanyDepartments(companyId: string): Promise<DepartmentSummary[]> {
  return db
    .select({ id: departments.id, departmentTypeCode: departments.departmentTypeCode, name: departments.name, parentDepartmentId: departments.parentDepartmentId })
    .from(departments)
    .where(and(eq(departments.companyId, companyId), eq(departments.active, true)));
}

export async function listDepartmentTypes() {
  return db.select().from(departmentTypes);
}

export interface CreateDepartmentInput {
  departmentTypeCode: string;
  name: string;
  parentDepartmentId?: string;
}

// İK Faz 0 — bugüne kadar departmanlar yalnızca seed/kurulum script'iyle
// oluşturuluyordu (hiçbir admin UI yoktu). Yeni bir "İK" departman TÜRÜ
// (HR) eklenmesiyle, fabrika yöneticisinin GERÇEK bir departman
// oluşturabilmesi gerekli hâle geldi — bu kendi başına bir İK özelliği
// değil, İK Faz 0'ın önkoşulu olan genel bir organizasyon eksikliği.
export async function createDepartment(companyId: string, input: CreateDepartmentInput): Promise<string> {
  const [type] = await db.select({ code: departmentTypes.code }).from(departmentTypes).where(eq(departmentTypes.code, input.departmentTypeCode)).limit(1);
  if (!type) throw new CoreError('Departman türü bulunamadı.');

  if (input.parentDepartmentId) {
    const [parent] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, input.parentDepartmentId), eq(departments.companyId, companyId))).limit(1);
    if (!parent) throw new CoreError('Üst departman bulunamadı.');
  }

  const id = newId();
  await db.insert(departments).values({ id, companyId, departmentTypeCode: input.departmentTypeCode, name: input.name, parentDepartmentId: input.parentDepartmentId });
  return id;
}
