import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, departments, departmentTypes, roles, users, userDepartmentAccess } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createDepartment } from '../src/lib/departments';
import { createPosition, setUserOrgAssignment } from '../src/lib/org';
import { createEmployee } from '../src/lib/hr/employees';
import { addEmployeeContact, addEmployeeAddress, addEmployeeEmergencyContact, linkEmployeeToUser } from '../src/lib/hr/employees';
import { createEmployeeContract } from '../src/lib/hr/contracts';
import { createCompensation } from '../src/lib/hr/compensation';

// KVKK/Güvenlik/Audit raporunun kullanıcı talebi: "Deneme Ahmet A.Ş." adında
// örnek bir şirket, 50 personel (5'i IT'de) — kullanıcının TÜM senaryoları
// (rol bazlı erişim, alan-seviyesi maskeleme, MFA, oturum yönetimi...) canlı
// test edebilmesi için. Var olan lib/hr/* fonksiyonları KULLANILIYOR (raw
// INSERT değil) — böylece gerçek uygulama kodunun ürettiği kayıtlarla
// BİREBİR aynı şekil/doğrulama/employeeNumber sırası üretilir. İdempotent
// DEĞİL — aynı isimde şirket varsa çalıştırma reddedilir (kazara ikinci kez
// çalıştırıp veri ikizlemesi yaratmamak için).

const COMPANY_NAME = 'Deneme Ahmet A.Ş.';
const DEMO_PASSWORD = 'DenemeAhmet2026!';

const FIRST_NAMES_M = ['Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Yusuf', 'Emre', 'Burak', 'Caner', 'Deniz', 'Serkan', 'Onur', 'Kerem', 'Tolga', 'Volkan', 'Barış', 'Gökhan', 'Murat', 'Cem', 'Ozan', 'Kaan', 'Berk', 'Efe', 'Fatih'];
const FIRST_NAMES_F = ['Ayşe', 'Fatma', 'Emine', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Buse', 'Ece', 'Gizem', 'Pınar', 'Aylin', 'Derya', 'Tuğba', 'Sevgi', 'Nur', 'İrem', 'Yasemin', 'Burcu', 'Aslı', 'Cansu', 'Melis', 'Dilek', 'Sibel', 'Gamze'];
const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Aktaş', 'Erdoğan', 'Güneş', 'Bulut', 'Polat'];

interface EmployeeGroup {
  key: string;
  deptType: 'IT' | 'HR' | 'ACCOUNTING' | 'WAREHOUSE' | null;
  title: string;
  posCode: string;
  approvalLevel: number;
  count: number;
  baseSalary: number;
  roleCode: string | null;
  loginIndexes: number[]; // hangi index'ler (0-based, grup içinde) login hesabı alır
  emailPrefix?: string;
  isFactoryAdmin?: boolean;
}

const GROUPS: EmployeeGroup[] = [
  { key: 'GM', deptType: null, title: 'Genel Müdür', posCode: 'GM', approvalLevel: 5, count: 1, baseSalary: 150000, roleCode: 'FACTORY_ADMIN', loginIndexes: [0], emailPrefix: 'admin', isFactoryAdmin: true },

  { key: 'IT_MGR', deptType: 'IT', title: 'BT Müdürü', posCode: 'IT-MGR', approvalLevel: 3, count: 1, baseSalary: 95000, roleCode: 'IT_MANAGER', loginIndexes: [0], emailPrefix: 'it.mudur' },
  { key: 'IT_SYS', deptType: 'IT', title: 'Sistem Mühendisi', posCode: 'IT-SYS', approvalLevel: 1, count: 1, baseSalary: 60000, roleCode: 'SYSTEM_ENGINEER', loginIndexes: [0], emailPrefix: 'it.sistem' },
  { key: 'IT_NET', deptType: 'IT', title: 'Ağ Mühendisi', posCode: 'IT-NET', approvalLevel: 1, count: 1, baseSalary: 58000, roleCode: 'NETWORK_ENGINEER', loginIndexes: [] },
  { key: 'IT_SEC', deptType: 'IT', title: 'Güvenlik Mühendisi', posCode: 'IT-SEC', approvalLevel: 1, count: 1, baseSalary: 62000, roleCode: 'SECURITY_ENGINEER', loginIndexes: [] },
  { key: 'IT_SD', deptType: 'IT', title: 'Servis Masası Temsilcisi', posCode: 'IT-SD', approvalLevel: 0, count: 1, baseSalary: 38000, roleCode: 'SERVICE_DESK_AGENT', loginIndexes: [0], emailPrefix: 'it.servismasasi' },

  { key: 'HR_MGR', deptType: 'HR', title: 'İK Müdürü', posCode: 'HR-MGR', approvalLevel: 3, count: 1, baseSalary: 90000, roleCode: 'HR_MANAGER', loginIndexes: [0], emailPrefix: 'ik.mudur' },
  { key: 'HR_SPEC', deptType: 'HR', title: 'İK Uzmanı', posCode: 'HR-SPEC', approvalLevel: 0, count: 3, baseSalary: 42000, roleCode: 'HR_SPECIALIST', loginIndexes: [0], emailPrefix: 'ik.uzman' },

  { key: 'ACC_MGR', deptType: 'ACCOUNTING', title: 'Muhasebe Müdürü', posCode: 'ACC-MGR', approvalLevel: 3, count: 1, baseSalary: 92000, roleCode: 'ACCOUNTING_MANAGER', loginIndexes: [0], emailPrefix: 'muhasebe.mudur' },
  { key: 'ACC_STF', deptType: 'ACCOUNTING', title: 'Muhasebeci', posCode: 'ACC-STF', approvalLevel: 0, count: 4, baseSalary: 40000, roleCode: 'ACCOUNTANT', loginIndexes: [0], emailPrefix: 'muhasebe.personel' },
  { key: 'FIN_MGR', deptType: 'ACCOUNTING', title: 'Finans Müdürü', posCode: 'FIN-MGR', approvalLevel: 3, count: 1, baseSalary: 88000, roleCode: 'FINANCE_MANAGER', loginIndexes: [] },
  { key: 'FIN_STF', deptType: 'ACCOUNTING', title: 'Finans Uzmanı', posCode: 'FIN-STF', approvalLevel: 0, count: 1, baseSalary: 45000, roleCode: null, loginIndexes: [] },

  { key: 'WH_MGR', deptType: 'WAREHOUSE', title: 'Depo Müdürü', posCode: 'WH-MGR', approvalLevel: 2, count: 1, baseSalary: 70000, roleCode: 'WAREHOUSE_MANAGER', loginIndexes: [0], emailPrefix: 'depo.mudur' },
  { key: 'WH_STF', deptType: 'WAREHOUSE', title: 'Depo Personeli', posCode: 'WH-STF', approvalLevel: 0, count: 7, baseSalary: 32000, roleCode: 'WAREHOUSE_USER', loginIndexes: [0], emailPrefix: 'depo.personel' },

  { key: 'SALES_MGR', deptType: null, title: 'Satış Müdürü', posCode: 'SLS-MGR', approvalLevel: 2, count: 1, baseSalary: 85000, roleCode: null, loginIndexes: [] },
  { key: 'SALES_STF', deptType: null, title: 'Satış Personeli', posCode: 'SLS-STF', approvalLevel: 0, count: 7, baseSalary: 36000, roleCode: null, loginIndexes: [] },

  { key: 'PUR_MGR', deptType: null, title: 'Satın Alma Müdürü', posCode: 'PUR-MGR', approvalLevel: 2, count: 1, baseSalary: 87000, roleCode: null, loginIndexes: [] },
  { key: 'PUR_STF', deptType: null, title: 'Satın Alma Uzmanı', posCode: 'PUR-STF', approvalLevel: 0, count: 4, baseSalary: 41000, roleCode: null, loginIndexes: [] },

  { key: 'PROD_SUP', deptType: null, title: 'Üretim Sorumlusu', posCode: 'PRD-SUP', approvalLevel: 1, count: 1, baseSalary: 55000, roleCode: null, loginIndexes: [] },
  { key: 'PROD_STF', deptType: null, title: 'Üretim Personeli', posCode: 'PRD-STF', approvalLevel: 0, count: 11, baseSalary: 30000, roleCode: null, loginIndexes: [] }
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function nameFor(globalIndex: number): { firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' } {
  const isMale = globalIndex % 2 === 0;
  const pool = isMale ? FIRST_NAMES_M : FIRST_NAMES_F;
  const firstName = pool[globalIndex % pool.length];
  const lastName = LAST_NAMES[(globalIndex * 7 + 3) % LAST_NAMES.length];
  return { firstName, lastName, gender: isMale ? 'MALE' : 'FEMALE' };
}

function fakeIdentityRef(globalIndex: number): string {
  // GERÇEK bir TCKN algoritması DEĞİL — yalnızca 11 haneli, sınıflandırma/
  // maskeleme senaryolarını test etmeye yetecek FORMAT uyumlu sahte veri.
  const n = (10000000000 + globalIndex * 987654321) % 89999999999 + 10000000000;
  return String(n).slice(0, 11);
}

function birthDateFor(globalIndex: number): string {
  const age = 24 + (globalIndex % 32);
  const year = new Date().getFullYear() - age;
  const month = 1 + (globalIndex % 12);
  const day = 1 + (globalIndex % 27);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function hireDateFor(globalIndex: number, seniorityBiasDays: number): string {
  const daysAgo = seniorityBiasDays + (globalIndex % 400);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function main() {
  const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.name, COMPANY_NAME)).limit(1);
  if (existing) {
    console.log(`ZATEN VAR: "${COMPANY_NAME}" (id=${existing.id}) — tekrar çalıştırma iptal edildi.`);
    process.exit(1);
  }

  const companyId = newId();
  await db.insert(companies).values({
    id: companyId, name: COMPANY_NAME, taxId: '1234567890', taxOffice: 'Kadıköy Vergi Dairesi',
    mersisNo: '0123456789000010', tradeRegistryNo: '123456', address: 'Örnek Mahallesi, Demo Caddesi No:1',
    city: 'İstanbul', district: 'Kadıköy', accountingMode: 'FULL_ACCOUNTING'
  });
  console.log(`Şirket oluşturuldu: ${COMPANY_NAME} (${companyId})`);

  // --- Departmanlar (yalnızca modellenen 4 tür: ACCOUNTING/WAREHOUSE/IT/HR) ---
  const deptTypeRows = await db.select().from(departmentTypes);
  const deptTypeSet = new Set(deptTypeRows.map((r) => r.code));
  const REQUIRED_DEPT_TYPES: { code: 'IT' | 'HR' | 'ACCOUNTING' | 'WAREHOUSE'; name: string }[] = [
    { code: 'IT', name: 'Bilgi Teknolojileri' }, { code: 'HR', name: 'İnsan Kaynakları' },
    { code: 'ACCOUNTING', name: 'Muhasebe' }, { code: 'WAREHOUSE', name: 'Depo' }
  ];
  for (const t of REQUIRED_DEPT_TYPES) {
    if (!deptTypeSet.has(t.code)) throw new Error(`departmentTypes tablosunda "${t.code}" yok — önce migrate:run çalıştırılmalı.`);
  }
  const deptIdByType: Record<string, string> = {};
  for (const t of REQUIRED_DEPT_TYPES) {
    deptIdByType[t.code] = await createDepartment(companyId, { departmentTypeCode: t.code, name: t.name });
  }
  console.log('Departmanlar oluşturuldu:', Object.keys(deptIdByType).join(', '));

  // --- Roller (global, koda göre id çözümü) ---
  const roleRows = await db.select().from(roles);
  const roleIdByCode: Record<string, string> = {};
  for (const r of roleRows) roleIdByCode[r.code] = r.id;

  // --- Pozisyonlar ---
  const positionIdByGroupKey: Record<string, string> = {};
  for (const g of GROUPS) {
    positionIdByGroupKey[g.key] = await createPosition(companyId, { code: g.posCode, title: g.title, approvalLevel: g.approvalLevel });
  }
  console.log(`${GROUPS.length} pozisyon tanımlandı.`);

  // --- İlk kullanıcı (GM/factory admin) önce oluşturulur — sonraki tüm
  // sözleşme/ücret kayıtlarının createdByUserId'si bu olacak. ---
  const gmUserId = newId();
  await db.insert(users).values({
    id: gmUserId, companyId, fullName: 'Ahmet Korkmaz', email: 'admin@denemeahmet.local',
    passwordHash: hashPassword(DEMO_PASSWORD), active: true, isFactoryAdmin: true
  });

  type LoginUser = { userId: string; email: string; fullName: string; roleCode: string | null; deptType: string | null };
  const loginUsers: LoginUser[] = [{ userId: gmUserId, email: 'admin@denemeahmet.local', fullName: 'Ahmet Korkmaz', roleCode: 'FACTORY_ADMIN', deptType: null }];

  // --- 50 çalışan ---
  let globalIndex = 0;
  let seniorityBiasDays = 900; // yöneticiler daha uzun süredir işte gibi görünsün
  const employeeIdByGroupKeyIndex: Record<string, string[]> = {};

  for (const g of GROUPS) {
    employeeIdByGroupKeyIndex[g.key] = [];
    for (let i = 0; i < g.count; i++) {
      const isGm = g.key === 'GM';
      const { firstName, lastName, gender } = isGm ? { firstName: 'Ahmet', lastName: 'Korkmaz', gender: 'MALE' as const } : nameFor(globalIndex);
      const hasIdentity = globalIndex % 3 !== 0; // ~%66'sında TC kimlik dolu — bazıları boş, gerçekçi
      const salary = g.baseSalary + (globalIndex % 5) * 500;

      const employeeId = await createEmployee(companyId, {
        firstName, lastName, gender: gender === 'MALE' ? 'Erkek' : 'Kadın',
        birthDate: birthDateFor(globalIndex), nationality: 'Türkiye',
        identityReference: hasIdentity ? fakeIdentityRef(globalIndex) : undefined,
        maritalStatus: globalIndex % 4 === 0 ? 'Evli' : 'Bekar',
        hireDate: hireDateFor(globalIndex, seniorityBiasDays),
        departmentId: g.deptType ? deptIdByType[g.deptType] : undefined,
        positionId: positionIdByGroupKey[g.key],
        workLocation: 'Merkez'
      });
      employeeIdByGroupKeyIndex[g.key].push(employeeId);

      const emailLocal = isGm ? 'ahmet.korkmaz' : `${firstName.toLocaleLowerCase('tr-TR')}.${lastName.toLocaleLowerCase('tr-TR')}`.replace(/ı/g, 'i').replace(/[^a-z.]/g, '');
      await addEmployeeContact(companyId, employeeId, { contactType: 'EMAIL_WORK', value: `${emailLocal}@denemeahmet.local`, isPrimary: true });
      await addEmployeeContact(companyId, employeeId, { contactType: 'PHONE_MOBILE', value: `05${(300000000 + globalIndex * 1111).toString().slice(0, 9)}`, isPrimary: true });
      if (globalIndex % 3 === 0) {
        await addEmployeeAddress(companyId, employeeId, {
          addressType: 'HOME', line: `Örnek Sokak No:${(globalIndex % 40) + 1}`, city: 'İstanbul', district: 'Kadıköy', postalCode: '34700', isPrimary: true
        });
      }
      if (globalIndex % 5 === 0) {
        await addEmployeeEmergencyContact(companyId, employeeId, {
          fullName: `${nameFor(globalIndex + 13).firstName} ${LAST_NAMES[(globalIndex + 5) % LAST_NAMES.length]}`,
          relationship: 'Eş', phone: `05${(400000000 + globalIndex * 777).toString().slice(0, 9)}`, isPrimary: true
        });
      }

      const contractType = g.key === 'PROD_STF' && i >= g.count - 2 ? 'INTERNSHIP' : g.key === 'WH_STF' && i === g.count - 1 ? 'PART_TIME' : 'INDEFINITE';
      await createEmployeeContract(companyId, employeeId, gmUserId, { contractType, startDate: hireDateFor(globalIndex, seniorityBiasDays), weeklyWorkingHours: contractType === 'PART_TIME' ? 22.5 : 45 });
      await createCompensation(companyId, employeeId, gmUserId, { effectiveDate: hireDateFor(globalIndex, seniorityBiasDays), baseSalary: salary, currencyCode: 'TRY', changeReason: 'İşe giriş ücreti' });

      if (g.loginIndexes.includes(i) && !isGm) {
        const userId = newId();
        const email = `${g.emailPrefix}@denemeahmet.local`;
        await db.insert(users).values({ id: userId, companyId, fullName: `${firstName} ${lastName}`, email, passwordHash: hashPassword(DEMO_PASSWORD), active: true, isFactoryAdmin: false });
        await linkEmployeeToUser(companyId, employeeId, userId);
        await setUserOrgAssignment(companyId, userId, positionIdByGroupKey[g.key]);
        if (g.roleCode && g.deptType) {
          const roleId = roleIdByCode[g.roleCode];
          if (!roleId) throw new Error(`Rol bulunamadı: ${g.roleCode}`);
          await db.insert(userDepartmentAccess).values({ id: newId(), userId, departmentId: deptIdByType[g.deptType], roleId });
        }
        loginUsers.push({ userId, email, fullName: `${firstName} ${lastName}`, roleCode: g.roleCode, deptType: g.deptType });
      } else if (isGm) {
        await linkEmployeeToUser(companyId, employeeId, gmUserId);
      }

      globalIndex++;
    }
    seniorityBiasDays = Math.max(30, seniorityBiasDays - 90);
  }

  // --- Yönetici zinciri (MANAGER_CHAIN onay senaryoları için) ---
  const managerLinks: [string, string][] = [
    ['IT_SYS', 'IT_MGR'], ['IT_SD', 'IT_MGR'], ['HR_SPEC', 'HR_MGR'], ['ACC_STF', 'ACC_MGR'], ['WH_STF', 'WH_MGR']
  ];
  const findLoginUserByGroup = (key: string) => loginUsers.find((u) => GROUPS.find((g) => g.key === key)?.emailPrefix && u.email === `${GROUPS.find((g) => g.key === key)!.emailPrefix}@denemeahmet.local`);
  for (const [childKey, managerKey] of managerLinks) {
    const child = findLoginUserByGroup(childKey);
    const manager = findLoginUserByGroup(managerKey);
    if (child && manager) {
      await setUserOrgAssignment(companyId, child.userId, positionIdByGroupKey[childKey], manager.userId);
    }
  }

  console.log(`\n${globalIndex} çalışan oluşturuldu (IT: ${GROUPS.filter((g) => g.deptType === 'IT').reduce((s, g) => s + g.count, 0)}).`);
  console.log(`\nGiriş hesapları (parola hepsinde aynı: ${DEMO_PASSWORD}):`);
  for (const u of loginUsers) {
    console.log(`  ${u.email.padEnd(32)} ${u.fullName.padEnd(20)} ${u.roleCode ?? '(rolsuz)'}${u.deptType ? ' / ' + u.deptType : ''}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('SEED HATASI:', err);
  process.exit(1);
});
