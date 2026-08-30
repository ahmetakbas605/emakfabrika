import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, companies, departments } from '@/db/schema';
import { verifyPassword, generateSessionToken, tokensMatch } from '@/lib/auth';
import { getUserDepartmentAccess, listUserDepartmentAccess, PERMISSION_KEYS, type DepartmentAccess, type PermissionKey } from '@/lib/permissions';
import type { AuthedUser } from '@/lib/dal';

const FULL_PERMISSIONS: Record<PermissionKey, boolean> = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Record<PermissionKey, boolean>;

// emakerp/src/lib/mobile-auth.ts ile AYNI desen (opak "Bearer
// <userId>.<token>" — API-ARCHITECTURE.md §1'in web/mobil ikili yüzeyi).
// Kullanıcının isteği: "IT biriminin kullanacağı cihaz tablet olacağından,
// elimizde çalışan Android uygulamadan türeterek bir ITAndroid'i de
// hallet" — bu dosya o uygulamanın bağlanacağı GERÇEK backend ucu.
const MOBILE_SESSION_MIN_DAYS = 1;
const MOBILE_SESSION_MAX_DAYS = 90;
const FAILED_LOGIN_LIMIT = 5;

export interface MobileUser {
  id: string;
  fullName: string;
  email: string;
  companyId: string;
  companyName: string;
  isFactoryAdmin: boolean;
  employeeId: string | null;
}

function encodeMobileToken(userId: string, rawToken: string): string {
  return `${userId}.${rawToken}`;
}

function decodeMobileToken(token: string): { userId: string; rawToken: string } | null {
  const idx = token.indexOf('.');
  if (idx <= 0) return null;
  return { userId: token.slice(0, idx), rawToken: token.slice(idx + 1) };
}

export type MobileLoginResult = { ok: true; user: MobileUser; token: string } | { ok: false; status: number; error: string };

export async function mobileLogin(email: string, password: string, rememberDays: number): Promise<MobileLoginResult> {
  const [found] = await db
    .select({ user: users, companyName: companies.name })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.email, email))
    .limit(1);

  if (!found || !verifyPassword(password, found.user.passwordHash)) {
    if (found) {
      const attempts = found.user.failedLoginAttempts + 1;
      const shouldLock = attempts >= FAILED_LOGIN_LIMIT && found.user.active;
      await db.update(users).set({ failedLoginAttempts: attempts, ...(shouldLock ? { active: false } : {}) }).where(eq(users.id, found.user.id));
    }
    return { ok: false, status: 401, error: 'E-posta veya şifre hatalı.' };
  }
  if (!found.user.active) return { ok: false, status: 403, error: 'Bu kullanıcı pasifleştirilmiş — giriş yapılamaz.' };

  const rawToken = generateSessionToken();
  const days = Math.min(Math.max(Math.round(rememberDays) || 30, MOBILE_SESSION_MIN_DAYS), MOBILE_SESSION_MAX_DAYS);
  const mobileSessionExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.update(users).set({ mobileSessionToken: rawToken, mobileSessionExpiresAt, failedLoginAttempts: 0 }).where(eq(users.id, found.user.id));

  return {
    ok: true,
    token: encodeMobileToken(found.user.id, rawToken),
    user: { id: found.user.id, fullName: found.user.fullName, email: found.user.email, companyId: found.user.companyId, companyName: found.companyName, isFactoryAdmin: found.user.isFactoryAdmin, employeeId: found.user.employeeId }
  };
}

export async function resolveMobileUser(authorizationHeader: string | null): Promise<MobileUser | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  const decoded = decodeMobileToken(authorizationHeader.slice('Bearer '.length).trim());
  if (!decoded) return null;

  const [row] = await db
    .select({ user: users, companyName: companies.name })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, decoded.userId))
    .limit(1);
  if (!row) return null;
  const { user, companyName } = row;
  if (!user.mobileSessionToken || !tokensMatch(decoded.rawToken, user.mobileSessionToken)) return null;
  if (!user.mobileSessionExpiresAt || user.mobileSessionExpiresAt.getTime() < Date.now()) return null;
  if (!user.active) return null;

  return { id: user.id, fullName: user.fullName, email: user.email, companyId: user.companyId, companyName, isFactoryAdmin: user.isFactoryAdmin, employeeId: user.employeeId };
}

export async function mobileLogout(userId: string): Promise<void> {
  await db.update(users).set({ mobileSessionToken: null, mobileSessionExpiresAt: null }).where(eq(users.id, userId));
}

// requireDepartmentAccess (lib/dal.ts, web) İLE AYNI ruh — mobil için
// redirect() ETMEZ, JSON döner.
export function toAuthedUser(mobileUser: MobileUser): AuthedUser {
  return { id: mobileUser.id, companyId: mobileUser.companyId, companyName: mobileUser.companyName, fullName: mobileUser.fullName, email: mobileUser.email, isFactoryAdmin: mobileUser.isFactoryAdmin, employeeId: mobileUser.employeeId };
}

// lib/dal.ts:requireDepartmentAccess'in fabrika-yöneticisi fallback'iyle AYNI
// ilke — açık bir user_department_access satırı olmasa bile fabrika
// yöneticisi ŞİRKETİN TÜM departmanlarını (tam yetkiyle) görür/kullanır.
// GET /auth/me bu listeyi döner, ITAndroid'in Departmanlarım ekranı bunu kullanır.
export async function listMobileDepartments(user: MobileUser): Promise<DepartmentAccess[]> {
  const explicit = await listUserDepartmentAccess(user.id);
  if (!user.isFactoryAdmin) return explicit;

  const seen = new Set(explicit.map((a) => a.departmentId));
  const allDepartments = await db
    .select({ id: departments.id, departmentTypeCode: departments.departmentTypeCode, name: departments.name })
    .from(departments)
    .where(and(eq(departments.companyId, user.companyId), eq(departments.active, true)));

  const virtual: DepartmentAccess[] = allDepartments
    .filter((d) => !seen.has(d.id))
    .map((d) => ({ departmentId: d.id, departmentTypeCode: d.departmentTypeCode, departmentName: d.name, roleCode: 'FACTORY_ADMIN', roleName: 'Fabrika Yöneticisi', permissions: FULL_PERMISSIONS }));

  return [...explicit, ...virtual];
}

export type MobileAuthResult = { ok: true; user: MobileUser } | { ok: false; status: number; error: string };

export async function requireMobileUser(request: Request): Promise<MobileAuthResult> {
  const user = await resolveMobileUser(request.headers.get('authorization'));
  if (!user) return { ok: false, status: 401, error: 'Oturum geçersiz veya süresi dolmuş.' };
  return { ok: true, user };
}

export async function requireMobileDepartmentAccess(request: Request, departmentId: string): Promise<{ ok: true; user: MobileUser; access: DepartmentAccess } | { ok: false; status: number; error: string }> {
  const auth = await requireMobileUser(request);
  if (!auth.ok) return auth;

  const access = await getUserDepartmentAccess(auth.user.id, departmentId);
  if (access) return { ok: true, user: auth.user, access };

  // lib/dal.ts:requireDepartmentAccess'teki fabrika-yöneticisi fallback'iyle
  // AYNI ilke — bkz. listMobileDepartments üstündeki not.
  if (auth.user.isFactoryAdmin) {
    const all = await listMobileDepartments(auth.user);
    const virtualAccess = all.find((a) => a.departmentId === departmentId);
    if (virtualAccess) return { ok: true, user: auth.user, access: virtualAccess };
  }

  return { ok: false, status: 403, error: 'Bu departmana atanmış değilsiniz.' };
}
