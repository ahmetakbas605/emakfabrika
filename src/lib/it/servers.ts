import 'server-only';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { itAssets, computerDetails } from '@/db/schema';
import { ItError } from '@/lib/it/errors';

// Faz 14 (Server/VM) — bu fazın kendi PDF metni bu proje boyunca hiç
// yakalanmadı (dürüst bir boşluk, IT-ARCHITECTURE.md'nin Faz listesinde
// yalnızca başlık var). Burada CMDB/Asset Management'ın (Faz 4-5) ZATEN
// kurduğu altyapı üzerine minimal, gerekçeli bir katman: bir VM, bir
// SERVER asset'in fiziksel host'u olduğunu it_assets.hostAssetId ile
// işaretler; computer_details'in cpu/ramGb/storageGb alanları VM'lerde de
// (ayrı bir tablo AÇILMADAN) kullanılır.

export async function setVmHost(companyId: string, vmAssetId: string, hostAssetId: string | null): Promise<void> {
  const [vm] = await db.select({ id: itAssets.id, assetTypeCode: itAssets.assetTypeCode }).from(itAssets).where(and(eq(itAssets.id, vmAssetId), eq(itAssets.companyId, companyId))).limit(1);
  if (!vm) throw new ItError('VM bulunamadı.');
  if (vm.assetTypeCode !== 'VM') throw new ItError('Yalnızca VM tipi varlıklara host atanabilir.');

  if (hostAssetId) {
    const [host] = await db.select({ id: itAssets.id, assetTypeCode: itAssets.assetTypeCode }).from(itAssets).where(and(eq(itAssets.id, hostAssetId), eq(itAssets.companyId, companyId))).limit(1);
    if (!host) throw new ItError('Host sunucu bulunamadı.');
    if (host.assetTypeCode !== 'SERVER') throw new ItError('Host yalnızca SERVER tipi bir varlık olabilir.');
    if (hostAssetId === vmAssetId) throw new ItError('Bir VM kendi host\'u olamaz.');
  }

  await db.update(itAssets).set({ hostAssetId }).where(eq(itAssets.id, vmAssetId));
}

export interface HostWithVmSummary {
  hostId: string;
  hostTag: string;
  hostName: string;
  hostCpu: string;
  hostRamGb: number | null;
  hostStorageGb: number | null;
  vmCount: number;
  allocatedRamGb: number;
  allocatedStorageGb: number;
}

// Bir host'un kapasitesine karşı, üzerindeki VM'lerin TOPLAM ayrılan
// (allocated) kaynağı — "aşırı tahsis" (overcommit) durumunu görünür
// kılar, DB'de zorlanmaz (bilinçli — fiziksel sunucularda RAM overcommit
// meşru bir pratik olabilir, burada yalnızca GÖRÜNÜRLÜK sağlanıyor).
export async function listHostsWithVmSummary(companyId: string): Promise<HostWithVmSummary[]> {
  const hosts = await db
    .select({ id: itAssets.id, assetTag: itAssets.assetTag, name: itAssets.name, cpu: computerDetails.cpu, ramGb: computerDetails.ramGb, storageGb: computerDetails.storageGb })
    .from(itAssets)
    .leftJoin(computerDetails, eq(computerDetails.assetId, itAssets.id))
    .where(and(eq(itAssets.companyId, companyId), eq(itAssets.assetTypeCode, 'SERVER')));

  const vmAgg = await db
    .select({ hostAssetId: itAssets.hostAssetId, vmCount: sql<number>`COUNT(*)`, allocatedRamGb: sql<number>`COALESCE(SUM(${computerDetails.ramGb}), 0)`, allocatedStorageGb: sql<number>`COALESCE(SUM(${computerDetails.storageGb}), 0)` })
    .from(itAssets)
    .leftJoin(computerDetails, eq(computerDetails.assetId, itAssets.id))
    .where(and(eq(itAssets.companyId, companyId), eq(itAssets.assetTypeCode, 'VM')))
    .groupBy(itAssets.hostAssetId);

  const aggByHost = new Map(vmAgg.filter((v) => v.hostAssetId).map((v) => [v.hostAssetId as string, v]));

  return hosts.map((h) => {
    const agg = aggByHost.get(h.id);
    return { hostId: h.id, hostTag: h.assetTag, hostName: h.name, hostCpu: h.cpu ?? '', hostRamGb: h.ramGb, hostStorageGb: h.storageGb, vmCount: Number(agg?.vmCount ?? 0), allocatedRamGb: Number(agg?.allocatedRamGb ?? 0), allocatedStorageGb: Number(agg?.allocatedStorageGb ?? 0) };
  });
}

export async function listVmsForHost(hostAssetId: string) {
  return db
    .select({ id: itAssets.id, assetTag: itAssets.assetTag, name: itAssets.name, status: itAssets.status, cpu: computerDetails.cpu, ramGb: computerDetails.ramGb, storageGb: computerDetails.storageGb })
    .from(itAssets)
    .leftJoin(computerDetails, eq(computerDetails.assetId, itAssets.id))
    .where(and(eq(itAssets.hostAssetId, hostAssetId), eq(itAssets.assetTypeCode, 'VM')));
}

export async function listUnhostedVms(companyId: string) {
  return db.select({ id: itAssets.id, assetTag: itAssets.assetTag, name: itAssets.name }).from(itAssets).where(and(eq(itAssets.companyId, companyId), eq(itAssets.assetTypeCode, 'VM'), sql`${itAssets.hostAssetId} IS NULL`));
}
