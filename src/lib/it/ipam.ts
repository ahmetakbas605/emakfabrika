import 'server-only';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { networkSubnets, networkVlans, ipAddresses, ipAssignments, itAssets, networkInterfaces, branches } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';
import { listUsableHostIps } from '@/lib/it/cidr';

// --- VLAN ---

export interface CreateVlanInput {
  branchId?: string;
  vlanNumber: number;
  name: string;
  description?: string;
  gateway?: string;
  dhcpEnabled?: boolean;
  purpose?: string;
  networkZone?: string;
  securityLevel?: string;
}

export async function createVlan(companyId: string, input: CreateVlanInput): Promise<string> {
  const id = newId();
  await db.insert(networkVlans).values({ id, companyId, ...input });
  return id;
}

export async function listVlans(companyId: string) {
  return db
    .select({ id: networkVlans.id, vlanNumber: networkVlans.vlanNumber, name: networkVlans.name, purpose: networkVlans.purpose, branchName: branches.name })
    .from(networkVlans)
    .leftJoin(branches, eq(branches.id, networkVlans.branchId))
    .where(eq(networkVlans.companyId, companyId));
}

// --- Subnet ---

export interface CreateSubnetInput {
  branchId?: string;
  cidr: string;
  gateway?: string;
  dnsPrimary?: string;
  dnsSecondary?: string;
  vlanId?: string;
  dhcpEnabled?: boolean;
  description?: string;
}

export async function createSubnet(companyId: string, input: CreateSubnetInput): Promise<string> {
  listUsableHostIps(input.cidr); // CIDR formatını doğrular, geçersizse fırlatır
  const id = newId();
  await db.insert(networkSubnets).values({ id, companyId, ...input });
  return id;
}

export async function listSubnets(companyId: string) {
  return db
    .select({ id: networkSubnets.id, cidr: networkSubnets.cidr, gateway: networkSubnets.gateway, vlanNumber: networkVlans.vlanNumber, branchName: branches.name })
    .from(networkSubnets)
    .leftJoin(networkVlans, eq(networkVlans.id, networkSubnets.vlanId))
    .leftJoin(branches, eq(branches.id, networkSubnets.branchId))
    .where(eq(networkSubnets.companyId, companyId));
}

export async function getSubnet(companyId: string, subnetId: string) {
  const [row] = await db.select().from(networkSubnets).where(and(eq(networkSubnets.id, subnetId), eq(networkSubnets.companyId, companyId))).limit(1);
  if (!row) throw new ItError('Subnet bulunamadı.');
  return row;
}

// IPAM.md §1 — TÜM adresler önceden satır olarak oluşturulmaz; "dolu"
// (ip_addresses'te satırı olan) adresler DB'den, "boş" (available) adresler
// CIDR aralığından HESAPLANARAK birleştirilir.
export interface IpRow {
  ipAddress: string;
  status: string;
  id: string | null;
}

export async function listSubnetIps(companyId: string, subnetId: string): Promise<{ ips: IpRow[]; truncated: boolean }> {
  const subnet = await getSubnet(companyId, subnetId);
  const { ips: allIps, truncated } = listUsableHostIps(subnet.cidr);

  const existingRows = await db.select({ id: ipAddresses.id, ipAddress: ipAddresses.ipAddress, status: ipAddresses.status }).from(ipAddresses).where(eq(ipAddresses.subnetId, subnetId));
  const byAddress = new Map(existingRows.map((r) => [r.ipAddress, r]));

  const result: IpRow[] = allIps.map((ip) => {
    const existing = byAddress.get(ip);
    return existing ? { ipAddress: ip, status: existing.status, id: existing.id } : { ipAddress: ip, status: 'AVAILABLE', id: null };
  });
  return { ips: result, truncated };
}

// --- IP Assignment ---
// IPAM.md §3 — çakışma kontrolü: assignIp'ten ÖNCE aktif bir atama var mı
// kontrol edilir, varsa reddedilir. Bu upfront-reddetme sayesinde "aynı IP'ye
// iki aktif atama" durumu bu kod yolundan ASLA oluşamaz — ayrı bir
// detectIpConflict tarama fonksiyonu bu yüzden GEREKMEDİ (gereksiz
// abstraction, madde 87).
export interface AssignIpInput {
  subnetId: string;
  ipAddress: string;
  assetId?: string;
  networkInterfaceId?: string;
  assignmentType?: (typeof ipAssignments.$inferInsert)['assignmentType'];
}

export async function assignIp(companyId: string, input: AssignIpInput): Promise<void> {
  await getSubnet(companyId, input.subnetId); // var mı + şirkete ait mi doğrular

  await db.transaction(async (tx) => {
    let [row] = await tx.select().from(ipAddresses).where(and(eq(ipAddresses.subnetId, input.subnetId), eq(ipAddresses.ipAddress, input.ipAddress))).limit(1);

    if (row) {
      const [activeAssignment] = await tx.select({ id: ipAssignments.id }).from(ipAssignments).where(and(eq(ipAssignments.ipAddressId, row.id), isNull(ipAssignments.releasedAt))).limit(1);
      if (activeAssignment) throw new ItError(`${input.ipAddress} zaten atanmış — önce mevcut atamayı serbest bırakın.`);
      if (row.status === 'BLOCKED') throw new ItError(`${input.ipAddress} bloke edilmiş, atanamaz.`);
    } else {
      const id = newId();
      await tx.insert(ipAddresses).values({ id, subnetId: input.subnetId, ipAddress: input.ipAddress, status: 'ASSIGNED' });
      row = { id, subnetId: input.subnetId, ipAddress: input.ipAddress, ipVersion: 'IPV4', status: 'ASSIGNED' };
    }

    await tx.update(ipAddresses).set({ status: 'ASSIGNED' }).where(eq(ipAddresses.id, row.id));
    await tx.insert(ipAssignments).values({ id: newId(), ipAddressId: row.id, assetId: input.assetId, networkInterfaceId: input.networkInterfaceId, assignmentType: input.assignmentType ?? 'STATIC' });
  });
}

// Serbest bırakılan bir ASSIGNED adres, başka aktif ataması yoksa satırı
// SİLİNİR (IPAM.md §1'in "yalnızca gerçekten kullanılan adresler satır
// tutar" ilkesine geri döner) — RESERVED/BLOCKED adresler bu fonksiyonla
// DOKUNULMAZ, onlar reserveIp/blockIp üzerinden ayrıca yönetilir.
export async function releaseIp(companyId: string, assignmentId: string): Promise<void> {
  const [assignment] = await db
    .select({ id: ipAssignments.id, ipAddressId: ipAssignments.ipAddressId, releasedAt: ipAssignments.releasedAt })
    .from(ipAssignments)
    .innerJoin(ipAddresses, eq(ipAddresses.id, ipAssignments.ipAddressId))
    .innerJoin(networkSubnets, eq(networkSubnets.id, ipAddresses.subnetId))
    .where(and(eq(ipAssignments.id, assignmentId), eq(networkSubnets.companyId, companyId)))
    .limit(1);
  if (!assignment) throw new ItError('Atama bulunamadı.');
  if (assignment.releasedAt) throw new ItError('Bu atama zaten serbest bırakılmış.');

  await db.transaction(async (tx) => {
    await tx.update(ipAssignments).set({ releasedAt: new Date() }).where(eq(ipAssignments.id, assignmentId));
    const [ipRow] = await tx.select({ status: ipAddresses.status }).from(ipAddresses).where(eq(ipAddresses.id, assignment.ipAddressId)).limit(1);
    if (ipRow?.status === 'ASSIGNED') {
      await tx.delete(ipAddresses).where(eq(ipAddresses.id, assignment.ipAddressId));
    }
  });
}

export async function reserveIp(companyId: string, subnetId: string, ipAddress: string): Promise<void> {
  await getSubnet(companyId, subnetId);
  const [existing] = await db.select({ id: ipAddresses.id }).from(ipAddresses).where(and(eq(ipAddresses.subnetId, subnetId), eq(ipAddresses.ipAddress, ipAddress))).limit(1);
  if (existing) throw new ItError(`${ipAddress} zaten kullanımda (${existing.id}).`);
  await db.insert(ipAddresses).values({ id: newId(), subnetId, ipAddress, status: 'RESERVED' });
}

export async function listIpAssignments(companyId: string, subnetId: string) {
  return db
    .select({
      id: ipAssignments.id, ipAddress: ipAddresses.ipAddress, assetTag: itAssets.assetTag, interfaceName: networkInterfaces.name,
      assignmentType: ipAssignments.assignmentType, assignedAt: ipAssignments.assignedAt, releasedAt: ipAssignments.releasedAt
    })
    .from(ipAssignments)
    .innerJoin(ipAddresses, eq(ipAddresses.id, ipAssignments.ipAddressId))
    .innerJoin(networkSubnets, eq(networkSubnets.id, ipAddresses.subnetId))
    .leftJoin(itAssets, eq(itAssets.id, ipAssignments.assetId))
    .leftJoin(networkInterfaces, eq(networkInterfaces.id, ipAssignments.networkInterfaceId))
    .where(and(eq(networkSubnets.companyId, companyId), eq(ipAddresses.subnetId, subnetId), isNull(ipAssignments.releasedAt)));
}

// --- Network Interface ---

export interface CreateInterfaceInput {
  assetId: string;
  name: string;
  macAddress?: string;
  interfaceType?: (typeof networkInterfaces.$inferInsert)['interfaceType'];
  vlanId?: string;
}

export async function createInterface(companyId: string, input: CreateInterfaceInput): Promise<string> {
  const id = newId();
  await db.insert(networkInterfaces).values({ id, companyId, ...input });
  return id;
}

export async function listInterfaces(companyId: string) {
  return db
    .select({ id: networkInterfaces.id, name: networkInterfaces.name, macAddress: networkInterfaces.macAddress, interfaceType: networkInterfaces.interfaceType, assetTag: itAssets.assetTag, vlanNumber: networkVlans.vlanNumber })
    .from(networkInterfaces)
    .innerJoin(itAssets, eq(itAssets.id, networkInterfaces.assetId))
    .leftJoin(networkVlans, eq(networkVlans.id, networkInterfaces.vlanId))
    .where(eq(networkInterfaces.companyId, companyId));
}

// IPAM.md §5 — global arama: bir IP arandığında hangi varlık/interface/
// subnet/VLAN'a ait olduğunu tek sorguda döner (tam "arama endpoint'i"
// Faz 16'da (Reports/Dashboard) kodlanacak, bu yalnızca alttaki JOIN zinciri).
export async function searchIp(companyId: string, ipAddress: string) {
  const [row] = await db
    .select({
      ipAddress: ipAddresses.ipAddress, status: ipAddresses.status, subnetCidr: networkSubnets.cidr,
      assetTag: itAssets.assetTag, assetName: itAssets.name, interfaceName: networkInterfaces.name, vlanNumber: networkVlans.vlanNumber
    })
    .from(ipAddresses)
    .innerJoin(networkSubnets, eq(networkSubnets.id, ipAddresses.subnetId))
    .leftJoin(ipAssignments, and(eq(ipAssignments.ipAddressId, ipAddresses.id), isNull(ipAssignments.releasedAt)))
    .leftJoin(itAssets, eq(itAssets.id, ipAssignments.assetId))
    .leftJoin(networkInterfaces, eq(networkInterfaces.id, ipAssignments.networkInterfaceId))
    .leftJoin(networkVlans, eq(networkVlans.id, networkSubnets.vlanId))
    .where(and(eq(networkSubnets.companyId, companyId), eq(ipAddresses.ipAddress, ipAddress)))
    .limit(1);
  return row ?? null;
}
