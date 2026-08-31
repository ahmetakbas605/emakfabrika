import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { eamAssets, eamAssetTypes, branches, itLocations } from '@/db/schema';
import { newId } from '@/lib/id';
import { EamError } from './errors';

// Holding ERP Faz 6 (EAM) — genel fabrika ekipmanı/bina varlık kaydı.
// it_assets'in KAPSAMADIĞI (bilgisayar/ağ/yazılım değil, kompresör/
// jeneratör/HVAC/bina) gerçekten yeni bir veri modeli.

export interface CreateEamAssetInput {
  assetTypeCode: string;
  code: string;
  name: string;
  branchId?: string;
  // Holding ERP Faz 7 (Tesis) — OPSİYONEL, it_locations'a (BUILDING/FLOOR/
  // ROOM) bağlanır. locationNote İLE BİRLİKTE kullanılabilir — biçimsel
  // hiyerarşi kurulmadıysa yalnızca locationNote yeterli kalır.
  locationId?: string;
  locationNote?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  responsibleUserId?: string;
  departmentId?: string;
  purchaseDate?: string;
  purchaseCost?: number;
}

export async function createEamAsset(companyId: string, input: CreateEamAssetInput): Promise<string> {
  const id = newId();
  await db.insert(eamAssets).values({
    id, companyId, assetTypeCode: input.assetTypeCode, code: input.code, name: input.name, branchId: input.branchId, locationId: input.locationId,
    locationNote: input.locationNote ?? '', manufacturer: input.manufacturer ?? '', model: input.model ?? '', serialNumber: input.serialNumber ?? '',
    responsibleUserId: input.responsibleUserId, departmentId: input.departmentId, purchaseDate: input.purchaseDate,
    purchaseCost: input.purchaseCost === undefined ? undefined : String(input.purchaseCost)
  });
  return id;
}

export async function listEamAssets(companyId: string) {
  return db
    .select({
      id: eamAssets.id, code: eamAssets.code, name: eamAssets.name, assetTypeCode: eamAssets.assetTypeCode, assetTypeName: eamAssetTypes.name,
      branchName: branches.name, locationName: itLocations.name, locationNote: eamAssets.locationNote, status: eamAssets.status
    })
    .from(eamAssets)
    .innerJoin(eamAssetTypes, eq(eamAssetTypes.code, eamAssets.assetTypeCode))
    .leftJoin(branches, eq(branches.id, eamAssets.branchId))
    .leftJoin(itLocations, eq(itLocations.id, eamAssets.locationId))
    .where(eq(eamAssets.companyId, companyId))
    .orderBy(desc(eamAssets.createdAt));
}

export async function getEamAsset(companyId: string, assetId: string) {
  const [row] = await db.select().from(eamAssets).where(and(eq(eamAssets.id, assetId), eq(eamAssets.companyId, companyId))).limit(1);
  if (!row) throw new EamError('Ekipman/varlık bulunamadı.');
  return row;
}

export async function listEamAssetTypes() {
  return db.select().from(eamAssetTypes);
}

// Bu, branches için ilk gerçek "listeleme" tüketicisi — bugüne kadar yalnızca
// it_locations.branchId gibi bir FK olarak referans alınıyordu, kendi
// lib fonksiyonu yoktu.
export async function listBranches(companyId: string) {
  return db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.companyId, companyId));
}

// MAINTENANCE.md §4'ün changeAssetStatus'uyla AYNI amaç, ama İT'nin tam
// durum-geçmişi (it_asset_status_history) tablosu BİLİNÇLİ OLARAK
// kurulmadı (schema.ts'in kendi yorumu — bu fazın kapsamı bir denetim izi
// gerektirmiyor). Durum doğrudan güncellenir.
export async function changeEamAssetStatus(companyId: string, assetId: string, status: (typeof eamAssets.$inferInsert)['status']): Promise<void> {
  await getEamAsset(companyId, assetId);
  await db.update(eamAssets).set({ status }).where(eq(eamAssets.id, assetId));
}
