import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { departments } from '@/db/schema';

export interface DepartmentSummary {
  id: string;
  departmentTypeCode: string;
  name: string;
}

// Fabrika yöneticisi hiçbir departmana açıkça atanmamış olsa bile HEPSİNİ
// görebilmeli (requireDepartmentAccess'teki fallback'in listeleme karşılığı).
export async function listCompanyDepartments(companyId: string): Promise<DepartmentSummary[]> {
  return db
    .select({ id: departments.id, departmentTypeCode: departments.departmentTypeCode, name: departments.name })
    .from(departments)
    .where(and(eq(departments.companyId, companyId), eq(departments.active, true)));
}
