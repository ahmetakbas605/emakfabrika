'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createVlan, createSubnet, createInterface, assignIp, releaseIp, reserveIp } from '@/lib/it/ipam';
import { ItError } from '@/lib/it/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const VlanSchema = z.object({
  vlanNumber: z.string().trim().min(1, 'VLAN numarası gerekli.'), name: z.string().trim().min(1, 'Ad gerekli.'),
  gateway: z.string().trim().optional(), purpose: z.string().trim().optional()
});

export async function createVlanAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = VlanSchema.safeParse({ vlanNumber: formData.get('vlanNumber'), name: formData.get('name'), gateway: optionalField(formData, 'gateway'), purpose: optionalField(formData, 'purpose') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createVlan(session.companyId, { vlanNumber: Number(parsed.data.vlanNumber), name: parsed.data.name, gateway: parsed.data.gateway, purpose: parsed.data.purpose });
  } catch {
    return { error: 'VLAN oluşturulamadı — bu numara zaten kullanılıyor olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network`);
  return { success: 'VLAN oluşturuldu.' };
}

const SubnetSchema = z.object({ cidr: z.string().trim().min(1, 'CIDR gerekli.'), gateway: z.string().trim().optional(), vlanId: z.string().trim().optional(), description: z.string().trim().optional() });

export async function createSubnetAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = SubnetSchema.safeParse({ cidr: formData.get('cidr'), gateway: optionalField(formData, 'gateway'), vlanId: optionalField(formData, 'vlanId'), description: optionalField(formData, 'description') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createSubnet(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Subnet oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network`);
  return { success: 'Subnet oluşturuldu.' };
}

const InterfaceSchema = z.object({ assetId: z.string().trim().min(1, 'Varlık seçilmeli.'), name: z.string().trim().min(1, 'Ad gerekli.'), macAddress: z.string().trim().optional(), interfaceType: z.enum(['ETHERNET', 'FIBER', 'WIFI']).optional(), vlanId: z.string().trim().optional() });

export async function createInterfaceAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = InterfaceSchema.safeParse({
    assetId: formData.get('assetId'), name: formData.get('name'), macAddress: optionalField(formData, 'macAddress'),
    interfaceType: optionalField(formData, 'interfaceType'), vlanId: optionalField(formData, 'vlanId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createInterface(session.companyId, parsed.data);
  revalidatePath(`/dashboard/departments/${departmentId}/it/network`);
  return { success: 'Ağ arayüzü kaydedildi.' };
}

const AssignIpSchema = z.object({ subnetId: z.string().trim().min(1), ipAddress: z.string().trim().min(1, 'IP adresi gerekli.'), assetId: z.string().trim().optional(), assignmentType: z.enum(['STATIC', 'DHCP', 'RESERVED']).optional() });

export async function assignIpAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = AssignIpSchema.safeParse({ subnetId: formData.get('subnetId'), ipAddress: formData.get('ipAddress'), assetId: optionalField(formData, 'assetId'), assignmentType: optionalField(formData, 'assignmentType') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await assignIp(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'IP atanamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network/${parsed.data.subnetId}`);
  return { success: 'IP atandı.' };
}

const ReleaseIpSchema = z.object({ subnetId: z.string().trim().min(1), assignmentId: z.string().trim().min(1) });

export async function releaseIpAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = ReleaseIpSchema.safeParse({ subnetId: formData.get('subnetId'), assignmentId: formData.get('assignmentId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await releaseIp(session.companyId, parsed.data.assignmentId);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Serbest bırakılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network/${parsed.data.subnetId}`);
  return { success: 'IP serbest bırakıldı.' };
}

const ReserveIpSchema = z.object({ subnetId: z.string().trim().min(1), ipAddress: z.string().trim().min(1, 'IP adresi gerekli.') });

export async function reserveIpAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'assign');
  const parsed = ReserveIpSchema.safeParse({ subnetId: formData.get('subnetId'), ipAddress: formData.get('ipAddress') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await reserveIp(session.companyId, parsed.data.subnetId, parsed.data.ipAddress);
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Rezerve edilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network/${parsed.data.subnetId}`);
  return { success: 'IP rezerve edildi.' };
}
