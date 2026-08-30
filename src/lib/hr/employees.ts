import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { employees, employeeContacts, employeeAddresses, employeeEmergencyContacts, departments, positions, costCenters, branches, users, EMPLOYMENT_STATUSES } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { HrError } from './errors';

// İK Faz 0 — Employee Core (İK Mimarisi raporu §03, §09). employees şirket
// geneli (department-scoped DEĞİL) — bir çalışan departman değiştirebilir,
// bu yüzden liste/detay erişimi requireDepartmentAccess'in HR departmanı
// için kontrol ettiği (İK personeli görebilir) ama VERİNİN KENDİSİ tek bir
// departmana AİT değil, tıpkı Satınalma'nın company-wide olması gibi.

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  identityReference?: string;
  maritalStatus?: string;
  hireDate: string;
  departmentId?: string;
  positionId?: string;
  managerEmployeeId?: string;
  costCenterId?: string;
  branchId?: string;
  workLocation?: string;
}

export async function createEmployee(companyId: string, input: CreateEmployeeInput): Promise<string> {
  if (input.departmentId) {
    const [d] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, input.departmentId), eq(departments.companyId, companyId))).limit(1);
    if (!d) throw new HrError('Departman bulunamadı.');
  }
  if (input.positionId) {
    const [p] = await db.select({ id: positions.id }).from(positions).where(and(eq(positions.id, input.positionId), eq(positions.companyId, companyId))).limit(1);
    if (!p) throw new HrError('Pozisyon bulunamadı.');
  }
  if (input.managerEmployeeId) {
    const [m] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.managerEmployeeId), eq(employees.companyId, companyId))).limit(1);
    if (!m) throw new HrError('Yönetici bulunamadı.');
  }
  if (input.costCenterId) {
    const [c] = await db.select({ id: costCenters.id }).from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.companyId, companyId))).limit(1);
    if (!c) throw new HrError('Masraf merkezi bulunamadı.');
  }
  if (input.branchId) {
    const [b] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.branchId), eq(branches.companyId, companyId))).limit(1);
    if (!b) throw new HrError('Şube/tesis bulunamadı.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const employeeNumber = await nextDocumentNo(tx, companyId, 'EMP', 'PRS', new Date().getFullYear(), 6);
    await tx.insert(employees).values({
      id, companyId, employeeNumber,
      firstName: input.firstName, lastName: input.lastName, preferredName: input.preferredName,
      gender: input.gender, birthDate: input.birthDate, nationality: input.nationality,
      identityReference: input.identityReference, maritalStatus: input.maritalStatus,
      hireDate: input.hireDate,
      departmentId: input.departmentId, positionId: input.positionId, managerEmployeeId: input.managerEmployeeId,
      costCenterId: input.costCenterId, branchId: input.branchId, workLocation: input.workLocation ?? ''
    });
    return id;
  });
}

export interface ListEmployeesFilter {
  departmentId?: string;
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];
}

export async function listEmployees(companyId: string, filter?: ListEmployeesFilter) {
  const conditions = [eq(employees.companyId, companyId)];
  if (filter?.departmentId) conditions.push(eq(employees.departmentId, filter.departmentId));
  if (filter?.employmentStatus) conditions.push(eq(employees.employmentStatus, filter.employmentStatus));

  return db
    .select({
      id: employees.id, employeeNumber: employees.employeeNumber, firstName: employees.firstName, lastName: employees.lastName,
      employmentStatus: employees.employmentStatus, hireDate: employees.hireDate,
      departmentId: employees.departmentId, departmentName: departments.name, positionTitle: positions.title
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(and(...conditions))
    .orderBy(desc(employees.createdAt));
}

export async function getEmployee(companyId: string, employeeId: string) {
  const [employee] = await db.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  const [department, position, manager, costCenter, branch, linkedUser, contacts, addresses, emergencyContacts] = await Promise.all([
    employee.departmentId ? db.select({ name: departments.name }).from(departments).where(eq(departments.id, employee.departmentId)).limit(1).then((r) => r[0]?.name ?? null) : null,
    employee.positionId ? db.select({ title: positions.title }).from(positions).where(eq(positions.id, employee.positionId)).limit(1).then((r) => r[0]?.title ?? null) : null,
    employee.managerEmployeeId ? db.select({ firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(eq(employees.id, employee.managerEmployeeId)).limit(1).then((r) => (r[0] ? `${r[0].firstName} ${r[0].lastName}` : null)) : null,
    employee.costCenterId ? db.select({ name: costCenters.name }).from(costCenters).where(eq(costCenters.id, employee.costCenterId)).limit(1).then((r) => r[0]?.name ?? null) : null,
    employee.branchId ? db.select({ name: branches.name }).from(branches).where(eq(branches.id, employee.branchId)).limit(1).then((r) => r[0]?.name ?? null) : null,
    db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(eq(users.employeeId, employeeId)).limit(1).then((r) => r[0] ?? null),
    db.select().from(employeeContacts).where(eq(employeeContacts.employeeId, employeeId)),
    db.select().from(employeeAddresses).where(eq(employeeAddresses.employeeId, employeeId)),
    db.select().from(employeeEmergencyContacts).where(eq(employeeEmergencyContacts.employeeId, employeeId))
  ]);

  return { employee, departmentName: department, positionTitle: position, managerName: manager, costCenterName: costCenter, branchName: branch, linkedUser, contacts, addresses, emergencyContacts };
}

export interface UpdateEmployeeOrganizationInput {
  departmentId?: string;
  positionId?: string;
  managerEmployeeId?: string;
  costCenterId?: string;
  branchId?: string;
  workLocation?: string;
}

// madde 100-103 — Terfi/Transfer'in KENDİ onay akışı (jenerik workflow
// motoruna yeni documentType'larla) İK Mimarisi raporunun İLERİKİ bir fazı
// (§09, Faz 5+). Bu fonksiyon o akış kurulana kadar İK'nın DOĞRUDAN
// düzenleme yapabildiği basit bir CRUD — Employee Core'un (Faz 0) kendi
// kapsamı, henüz bir onay zinciri İÇERMİYOR.
export async function updateEmployeeOrganization(companyId: string, employeeId: string, input: UpdateEmployeeOrganizationInput): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');

  if (input.managerEmployeeId === employeeId) throw new HrError('Bir çalışan kendi yöneticisi olamaz.');

  await db.update(employees).set({
    departmentId: input.departmentId, positionId: input.positionId, managerEmployeeId: input.managerEmployeeId,
    costCenterId: input.costCenterId, branchId: input.branchId, workLocation: input.workLocation
  }).where(eq(employees.id, employeeId));
}

export async function terminateEmployee(companyId: string, employeeId: string, terminationDate: string): Promise<void> {
  const [employee] = await db.select({ id: employees.id, employmentStatus: employees.employmentStatus }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  if (employee.employmentStatus === 'TERMINATED') throw new HrError('Çalışan zaten işten ayrılmış.');

  await db.update(employees).set({ employmentStatus: 'TERMINATED', terminationDate }).where(eq(employees.id, employeeId));
}

// --- İletişim / Adres / Acil Durum Kişisi (madde 10, 195) ---

export interface AddContactInput {
  contactType: (typeof employeeContacts.$inferInsert)['contactType'];
  value: string;
  isPrimary?: boolean;
}

export async function addEmployeeContact(companyId: string, employeeId: string, input: AddContactInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  const id = newId();
  await db.insert(employeeContacts).values({ id, employeeId, contactType: input.contactType, value: input.value, isPrimary: input.isPrimary ?? false });
  return id;
}

export interface AddAddressInput {
  addressType?: (typeof employeeAddresses.$inferInsert)['addressType'];
  line: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  isPrimary?: boolean;
}

export async function addEmployeeAddress(companyId: string, employeeId: string, input: AddAddressInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  const id = newId();
  await db.insert(employeeAddresses).values({
    id, employeeId, addressType: input.addressType ?? 'HOME', line: input.line,
    city: input.city ?? '', district: input.district ?? '', postalCode: input.postalCode ?? '', country: input.country ?? 'Türkiye', isPrimary: input.isPrimary ?? false
  });
  return id;
}

export interface AddEmergencyContactInput {
  fullName: string;
  relationship?: string;
  phone: string;
  isPrimary?: boolean;
}

export async function addEmployeeEmergencyContact(companyId: string, employeeId: string, input: AddEmergencyContactInput): Promise<string> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  const id = newId();
  await db.insert(employeeEmergencyContacts).values({ id, employeeId, fullName: input.fullName, relationship: input.relationship ?? '', phone: input.phone, isPrimary: input.isPrimary ?? false });
  return id;
}

// İK Faz 0 — bir ERP giriş hesabını özlük kaydına bağlar (schema.ts:users.
// employeeId yorumu). TEK YÖNLÜ ve opsiyonel — bir employee birden fazla
// user'a bağlanamaz (bir kişinin birden fazla ERP hesabı olması anlamsız),
// bu yüzden hedef employee zaten başka bir user'a bağlıysa reddedilir. Aynı
// şekilde hedef user zaten BAŞKA bir employee'ye bağlıysa da reddedilir —
// bu kontrol olmadan users.employeeId tek sütun olduğu için ikinci bir
// bağlama çağrısı önceki bağlantıyı SESSİZCE üzerine yazıp employeeId'yi
// sahipsiz bırakabilirdi.
export async function linkEmployeeToUser(companyId: string, employeeId: string, userId: string): Promise<void> {
  const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId))).limit(1);
  if (!employee) throw new HrError('Çalışan bulunamadı.');
  const [user] = await db.select({ id: users.id, employeeId: users.employeeId }).from(users).where(and(eq(users.id, userId), eq(users.companyId, companyId))).limit(1);
  if (!user) throw new HrError('Kullanıcı bulunamadı.');
  if (user.employeeId && user.employeeId !== employeeId) throw new HrError('Bu kullanıcı zaten başka bir çalışana bağlı.');

  const [alreadyLinked] = await db.select({ id: users.id }).from(users).where(eq(users.employeeId, employeeId)).limit(1);
  if (alreadyLinked && alreadyLinked.id !== userId) throw new HrError('Bu çalışan zaten başka bir ERP hesabına bağlı.');

  await db.update(users).set({ employeeId }).where(eq(users.id, userId));
}
