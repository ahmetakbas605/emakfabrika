import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, companies, departments } from '@/db/schema';
import { readSessionCookie } from '@/lib/session';
import { validateUserSession, touchSessionActivity } from '@/lib/security/sessions';
import { getUserDepartmentAccess, PERMISSION_KEYS, type DepartmentAccess, type PermissionKey } from '@/lib/permissions';

export interface AuthedUser {
  id: string;
  companyId: string;
  companyName: string;
  // Holding ERP Faz 0 — bu şirketin bağlı olduğu holding. NULL olabilir
  // (henüz `migrate.ts`'in backfill adımı çalışmamış eski bir kayıt) —
  // holding-scope'lu her kontrol bunu ele almalı (bkz. requireHoldingAdmin).
  holdingId: string | null;
  fullName: string;
  email: string;
  isFactoryAdmin: boolean;
  isHoldingAdmin: boolean;
  // İK Faz 0'ın users.employeeId köprüsü (schema.ts yorumu) — bu oturumun
  // kendi özlük kaydı (İzin/Fazla Mesai gibi employeeId'ye bağlı öz-hizmet
  // akışları için). Bağlı değilse null (örn. dış danışman/salt-admin hesap).
  employeeId: string | null;
}

// emakerp/src/lib/dal.ts:getSession ile AYNI desen — cookie yalnızca bir
// işaretçi, gerçek doğrulama (sessionToken eşleşmesi + süre + aktiflik) her
// zaman DB'ye karşı yapılır. React cache() ile aynı render geçişinde tek sorgu.
export const getSession = cache(async (): Promise<AuthedUser | null> => {
  const pointer = await readSessionCookie();
  if (!pointer) return null;

  // Core Security Faz 4 — doğrulama artık user_sessions'a karşı (çoklu
  // eşzamanlı oturum + tek tek iptal). "Database session" ilkesi AYNI
  // kaldı: JWT yalnızca bir işaretçi, gerçek doğrulama her istekte DB'ye
  // karşı yapılıyor.
  const sessionRow = await validateUserSession(pointer.sessionId, pointer.sessionToken);
  if (!sessionRow) return null;

  const rows = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      companyName: companies.name,
      holdingId: companies.holdingId,
      fullName: users.fullName,
      email: users.email,
      isFactoryAdmin: users.isFactoryAdmin,
      isHoldingAdmin: users.isHoldingAdmin,
      employeeId: users.employeeId,
      active: users.active
    })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, pointer.userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.active) return null;

  touchSessionActivity(sessionRow.id);

  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.companyName,
    holdingId: row.holdingId,
    fullName: row.fullName,
    email: row.email,
    isFactoryAdmin: row.isFactoryAdmin,
    isHoldingAdmin: row.isHoldingAdmin,
    employeeId: row.employeeId
  };
});

export async function requireSession(): Promise<AuthedUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

// PDF madde 65'in "platform yöneticisi" kavramının bu fabrikanın KENDİ
// içindeki karşılığı — emakerp'teki cross-tenant requirePlatformAdmin İLE
// KARIŞTIRILMAMALI, bu yalnızca TEK fabrikanın en yüksek yetkilisi.
export async function requireFactoryAdmin(): Promise<AuthedUser> {
  const session = await requireSession();
  if (!session.isFactoryAdmin) redirect('/dashboard');
  return session;
}

// Holding ERP Faz 0 — requireFactoryAdmin'in TEK ŞİRKET sınırını aşan üst
// karşılığı: aynı holding'deki TÜM şirketlere erişim (konsolide raporlama,
// holding-geneli kullanıcı/şirket yönetimi). holdingId NULL ise (backfill
// henüz uygulanmamış eski bir kayıt) reddedilir — "her şirkete erişebilir"
// gibi tehlikeli bir varsayılan YERİNE açıkça engellenir.
export async function requireHoldingAdmin(): Promise<AuthedUser & { holdingId: string }> {
  const session = await requireSession();
  if (!session.isHoldingAdmin || !session.holdingId) redirect('/dashboard');
  return session as AuthedUser & { holdingId: string };
}

export interface DepartmentSession {
  session: AuthedUser;
  access: DepartmentAccess;
}

const FULL_PERMISSIONS: Record<PermissionKey, boolean> = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Record<PermissionKey, boolean>;

// SECURITY-ARCHITECTURE.md §3 — üçüncü katman. requirePermission/requireModule
// (emakerp) İLE AYNI ruhta ama tek fonksiyonda birleşik: "bu kullanıcı bu
// departmana atanmış mı" + (opsiyonel) "o departmandaki rolü bu izne sahip mi".
export async function requireDepartmentAccess(departmentId: string, permission?: PermissionKey): Promise<DepartmentSession> {
  const session = await requireSession();

  const access = await getUserDepartmentAccess(session.id, departmentId);
  if (access) {
    if (permission && !access.permissions[permission]) redirect('/dashboard');
    return { session, access };
  }

  // Fabrika yöneticisi, açıkça bir user_department_access satırı OLMASA bile
  // KENDİ ŞİRKETİNİN her departmanına erişir — hangi rol/izinle çalıştığını
  // belli etmek için TAM yetkili sanal bir erişim satırı üretiyoruz (DB'ye
  // yazılmaz). companyId filtresi ZORUNLU: 2026-08-29'da IT-SECURITY.md §6'nın
  // kiracı izolasyon testiyle GERÇEKTEN yakalanan bir güvenlik açığı — bu
  // filtre olmadan, başka bir şirketin factory admin'i, departmentId'sini
  // biliyorsa/tahmin ediyorsa KENDİ oturumuyla o departmana (ve o departmanın
  // adı/türü üzerinden dolaylı olarak diğer akışlara) erişebiliyordu.
  if (session.isFactoryAdmin) {
    const [dept] = await db
      .select({ id: departments.id, departmentTypeCode: departments.departmentTypeCode, name: departments.name })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.companyId, session.companyId)))
      .limit(1);
    if (!dept) redirect('/dashboard');
    return {
      session,
      access: {
        departmentId: dept.id,
        departmentTypeCode: dept.departmentTypeCode,
        departmentName: dept.name,
        roleCode: 'FACTORY_ADMIN',
        roleName: 'Fabrika Yöneticisi',
        permissions: FULL_PERMISSIONS
      }
    };
  }

  // Holding ERP Faz 0 — factory admin'in AYNI mantığı, bir seviye yukarı:
  // holding yöneticisi kendi şirketine atanmamış olsa bile, KENDİ HOLDİNG'İNE
  // ait BAŞKA bir şirketin departmanına erişebilir. companyId eşleşmesi
  // YERİNE holdingId eşleşmesi kontrol edilir — 2026-08-29'un company-scope
  // sızıntı dersiyle AYNI disiplin, bir seviye genişletilmiş: dept'in
  // company'sinin holdingId'si session'ınkiyle BİREBİR eşleşmeli.
  if (session.isHoldingAdmin && session.holdingId) {
    const [dept] = await db
      .select({ id: departments.id, departmentTypeCode: departments.departmentTypeCode, name: departments.name, companyHoldingId: companies.holdingId })
      .from(departments)
      .innerJoin(companies, eq(companies.id, departments.companyId))
      .where(eq(departments.id, departmentId))
      .limit(1);
    if (!dept || dept.companyHoldingId !== session.holdingId) redirect('/dashboard');
    return {
      session,
      access: {
        departmentId: dept.id,
        departmentTypeCode: dept.departmentTypeCode,
        departmentName: dept.name,
        roleCode: 'HOLDING_ADMIN',
        roleName: 'Holding Yöneticisi',
        permissions: FULL_PERMISSIONS
      }
    };
  }

  redirect('/dashboard');
}

// IT (varlık ataması) ve ileride başka departmanların da ihtiyaç duyacağı
// basit bir liste — requireDepartmentAccess'in AYNI dosyasında, tekrar
// tekrar aynı sorguyu yazmamak için.
export async function listCompanyUsers(companyId: string) {
  return db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(eq(users.companyId, companyId));
}
