import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { userDepartmentAccess, rolePermissions, roles, departments } from '@/db/schema';

export const PERMISSION_KEYS = ['view', 'create', 'update', 'delete', 'approve', 'cancel', 'export', 'print', 'post', 'close_period', 'reopen_period'] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface DepartmentAccess {
  departmentId: string;
  departmentTypeCode: string;
  departmentName: string;
  roleCode: string;
  roleName: string;
  permissions: Record<PermissionKey, boolean>;
}

// SECURITY-ARCHITECTURE.md §3 — üçüncü katman: "bu kullanıcı bu SPESİFİK
// departmana atanmış mı" + o departmandaki rolünün, o departmanın MODÜLÜ
// (department_type_code) içinde hangi izinlere sahip olduğu.
export async function listUserDepartmentAccess(userId: string): Promise<DepartmentAccess[]> {
  const rows = await db
    .select({
      departmentId: departments.id,
      departmentTypeCode: departments.departmentTypeCode,
      departmentName: departments.name,
      roleCode: roles.code,
      roleName: roles.name,
      permissionCode: rolePermissions.permissionCode
    })
    .from(userDepartmentAccess)
    .innerJoin(departments, eq(departments.id, userDepartmentAccess.departmentId))
    .innerJoin(roles, eq(roles.id, userDepartmentAccess.roleId))
    .leftJoin(
      rolePermissions,
      and(eq(rolePermissions.roleId, userDepartmentAccess.roleId), eq(rolePermissions.moduleKey, departments.departmentTypeCode))
    )
    .where(and(eq(userDepartmentAccess.userId, userId), eq(departments.active, true)));

  const byDepartment = new Map<string, DepartmentAccess>();
  for (const row of rows) {
    let entry = byDepartment.get(row.departmentId);
    if (!entry) {
      entry = {
        departmentId: row.departmentId,
        departmentTypeCode: row.departmentTypeCode,
        departmentName: row.departmentName,
        roleCode: row.roleCode,
        roleName: row.roleName,
        permissions: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Record<PermissionKey, boolean>
      };
      byDepartment.set(row.departmentId, entry);
    }
    if (row.permissionCode && (PERMISSION_KEYS as readonly string[]).includes(row.permissionCode)) {
      entry.permissions[row.permissionCode as PermissionKey] = true;
    }
  }
  return [...byDepartment.values()];
}

export async function getUserDepartmentAccess(userId: string, departmentId: string): Promise<DepartmentAccess | null> {
  const all = await listUserDepartmentAccess(userId);
  return all.find((a) => a.departmentId === departmentId) ?? null;
}
