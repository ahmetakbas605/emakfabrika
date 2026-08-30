'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createEmployee, updateEmployeeOrganization, terminateEmployee, addEmployeeContact, addEmployeeAddress, addEmployeeEmergencyContact, linkEmployeeToUser } from '@/lib/hr/employees';
import { HrError } from '@/lib/hr/errors';
import { optionalField } from '@/lib/form';
import { writeAuditLog } from '@/lib/security/audit';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof HrError ? err.message : fallback;
}

const CreateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'Ad gerekli.'),
  lastName: z.string().trim().min(1, 'Soyad gerekli.'),
  preferredName: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  identityReference: z.string().trim().optional(),
  maritalStatus: z.string().trim().optional(),
  hireDate: z.string().trim().min(1, 'İşe giriş tarihi gerekli.'),
  employeeDepartmentId: z.string().trim().optional(),
  positionId: z.string().trim().optional(),
  managerEmployeeId: z.string().trim().optional(),
  costCenterId: z.string().trim().optional(),
  workLocation: z.string().trim().optional()
});

export async function createEmployeeAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');

  const parsed = CreateEmployeeSchema.safeParse({
    firstName: formData.get('firstName'), lastName: formData.get('lastName'), preferredName: optionalField(formData, 'preferredName'),
    gender: optionalField(formData, 'gender'), birthDate: optionalField(formData, 'birthDate'), nationality: optionalField(formData, 'nationality'),
    identityReference: optionalField(formData, 'identityReference'), maritalStatus: optionalField(formData, 'maritalStatus'),
    hireDate: formData.get('hireDate'), employeeDepartmentId: optionalField(formData, 'employeeDepartmentId'), positionId: optionalField(formData, 'positionId'),
    managerEmployeeId: optionalField(formData, 'managerEmployeeId'), costCenterId: optionalField(formData, 'costCenterId'), workLocation: optionalField(formData, 'workLocation')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let newEmployeeId: string;
  try {
    newEmployeeId = await createEmployee(session.companyId, {
      firstName: parsed.data.firstName, lastName: parsed.data.lastName, preferredName: parsed.data.preferredName,
      gender: parsed.data.gender, birthDate: parsed.data.birthDate, nationality: parsed.data.nationality,
      identityReference: parsed.data.identityReference, maritalStatus: parsed.data.maritalStatus,
      hireDate: parsed.data.hireDate, departmentId: parsed.data.employeeDepartmentId, positionId: parsed.data.positionId,
      managerEmployeeId: parsed.data.managerEmployeeId, costCenterId: parsed.data.costCenterId, workLocation: parsed.data.workLocation
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Çalışan kaydedilemedi.') };
  }
  await writeAuditLog({
    companyId: session.companyId, userId: session.id, action: 'CREATE', entity: 'EMPLOYEE', entityId: newEmployeeId, module: 'HR',
    riskLevel: parsed.data.identityReference ? 'MEDIUM' : 'LOW',
    newValue: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, hireDate: parsed.data.hireDate, departmentId: parsed.data.employeeDepartmentId, hasIdentityReference: Boolean(parsed.data.identityReference) }
  });
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees`);
  return { success: 'Çalışan kaydedildi.' };
}

const UpdateOrgSchema = z.object({
  employeeDepartmentId: z.string().trim().optional(),
  positionId: z.string().trim().optional(),
  managerEmployeeId: z.string().trim().optional(),
  costCenterId: z.string().trim().optional(),
  workLocation: z.string().trim().optional()
});

export async function updateEmployeeOrganizationAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = UpdateOrgSchema.safeParse({
    employeeDepartmentId: optionalField(formData, 'employeeDepartmentId'), positionId: optionalField(formData, 'positionId'),
    managerEmployeeId: optionalField(formData, 'managerEmployeeId'), costCenterId: optionalField(formData, 'costCenterId'), workLocation: optionalField(formData, 'workLocation')
  });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await updateEmployeeOrganization(session.companyId, employeeId, {
      departmentId: parsed.data.employeeDepartmentId, positionId: parsed.data.positionId, managerEmployeeId: parsed.data.managerEmployeeId,
      costCenterId: parsed.data.costCenterId, workLocation: parsed.data.workLocation
    });
  } catch (err) {
    return { error: toErrorMessage(err, 'Güncellenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Organizasyon bilgisi güncellendi.' };
}

const TerminateSchema = z.object({ terminationDate: z.string().trim().min(1, 'Tarih gerekli.') });

export async function terminateEmployeeAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = TerminateSchema.safeParse({ terminationDate: formData.get('terminationDate') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await terminateEmployee(session.companyId, employeeId, parsed.data.terminationDate);
  } catch (err) {
    return { error: toErrorMessage(err, 'İşlem gerçekleştirilemedi.') };
  }
  await writeAuditLog({
    companyId: session.companyId, userId: session.id, action: 'UPDATE', entity: 'EMPLOYEE', entityId: employeeId, module: 'HR',
    riskLevel: 'MEDIUM', changedFields: { employmentStatus: 'TERMINATED' }, newValue: { terminationDate: parsed.data.terminationDate }
  });
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Çalışan işten ayrılış olarak işaretlendi.' };
}

const AddContactSchema = z.object({
  contactType: z.enum(['PHONE_MOBILE', 'PHONE_HOME', 'PHONE_WORK', 'EMAIL_PERSONAL', 'EMAIL_WORK', 'OTHER']),
  value: z.string().trim().min(1, 'Değer gerekli.')
});

export async function addEmployeeContactAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = AddContactSchema.safeParse({ contactType: formData.get('contactType'), value: formData.get('value') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addEmployeeContact(session.companyId, employeeId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Eklenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'İletişim bilgisi eklendi.' };
}

const AddAddressSchema = z.object({
  addressType: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
  line: z.string().trim().min(1, 'Adres gerekli.'),
  city: z.string().trim().optional(), district: z.string().trim().optional(), postalCode: z.string().trim().optional()
});

export async function addEmployeeAddressAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = AddAddressSchema.safeParse({
    addressType: optionalField(formData, 'addressType'), line: formData.get('line'),
    city: optionalField(formData, 'city'), district: optionalField(formData, 'district'), postalCode: optionalField(formData, 'postalCode')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addEmployeeAddress(session.companyId, employeeId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Eklenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Adres eklendi.' };
}

const AddEmergencySchema = z.object({
  fullName: z.string().trim().min(1, 'Ad soyad gerekli.'), relationship: z.string().trim().optional(), phone: z.string().trim().min(1, 'Telefon gerekli.')
});

export async function addEmployeeEmergencyContactAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = AddEmergencySchema.safeParse({ fullName: formData.get('fullName'), relationship: optionalField(formData, 'relationship'), phone: formData.get('phone') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await addEmployeeEmergencyContact(session.companyId, employeeId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Eklenemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Acil durum kişisi eklendi.' };
}

const LinkUserSchema = z.object({ userId: z.string().trim().min(1, 'Kullanıcı seçilmeli.') });

export async function linkEmployeeToUserAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = LinkUserSchema.safeParse({ userId: formData.get('userId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await linkEmployeeToUser(session.companyId, employeeId, parsed.data.userId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Bağlanamadı.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'ERP hesabı bağlandı.' };
}
