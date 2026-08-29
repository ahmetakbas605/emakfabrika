import 'server-only';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { itAssets, itAssetTypes, computerDetails, itAssetAssignments, itAssetStatusHistory, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// IT-DATABASE.md §3 — IT Asset Management (Faz 4).
// Faz 14 (Server/VM) — VM da computer_details'in cpu/ramGb/storageGb
// alanlarından FAYDALANIR (bir VM'in de vCPU/RAM/disk'i var), ayrı bir
// tablo GEREKMEDİ.
const COMPUTER_TYPE_CODES = new Set(['DESKTOP', 'LAPTOP', 'SERVER', 'VM']);

export interface CreateAssetInput {
  assetTag: string;
  assetTypeCode: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  branchId?: string;
  departmentId?: string;
  purchaseDate?: string;
  purchaseCost?: number | string;
  warrantyStart?: string;
  warrantyEnd?: string;
  hostAssetId?: string;
}

export async function createAsset(companyId: string, input: CreateAssetInput, createdByUserId: string): Promise<string> {
  const id = newId();
  await db.insert(itAssets).values({
    id,
    companyId,
    branchId: input.branchId,
    departmentId: input.departmentId,
    assetTypeCode: input.assetTypeCode,
    assetTag: input.assetTag,
    name: input.name,
    manufacturer: input.manufacturer ?? '',
    model: input.model ?? '',
    serialNumber: input.serialNumber ?? '',
    purchaseDate: input.purchaseDate,
    purchaseCost: input.purchaseCost !== undefined ? String(input.purchaseCost) : undefined,
    warrantyStart: input.warrantyStart,
    warrantyEnd: input.warrantyEnd,
    hostAssetId: input.hostAssetId,
    createdByUserId
  });

  // IT-DATABASE.md §3 — bilgisayar/sunucu tipi varlıklar için 1:1 detay satırı.
  if (COMPUTER_TYPE_CODES.has(input.assetTypeCode)) {
    await db.insert(computerDetails).values({ assetId: id });
  }

  await db.insert(itAssetStatusHistory).values({ id: newId(), assetId: id, fromStatus: 'NEW', toStatus: 'IN_STOCK', changedBy: createdByUserId, note: 'Varlık oluşturuldu.' });
  return id;
}

export async function listAssets(companyId: string) {
  return db
    .select({
      id: itAssets.id,
      assetTag: itAssets.assetTag,
      name: itAssets.name,
      manufacturer: itAssets.manufacturer,
      model: itAssets.model,
      serialNumber: itAssets.serialNumber,
      status: itAssets.status,
      assetTypeCode: itAssets.assetTypeCode,
      assetTypeName: itAssetTypes.name,
      ownerUserId: itAssets.ownerUserId
    })
    .from(itAssets)
    .innerJoin(itAssetTypes, eq(itAssetTypes.code, itAssets.assetTypeCode))
    .where(eq(itAssets.companyId, companyId))
    .orderBy(desc(itAssets.createdAt));
}

export async function listAssetTypes() {
  return db.select().from(itAssetTypes);
}

// PDF madde 6 — asset lifecycle. Sıkı bir geçiş tablosu YOK (ticket'ların
// aksine, SERVICE-DESK.md'de belgelendiği gibi PDF burada kesin bir akış
// vermiyor) — her durum değişikliği izin verilir, ama HER ZAMAN
// it_asset_status_history'e yazılır (denetim kaydı ZORUNLU).
export async function changeAssetStatus(companyId: string, assetId: string, toStatus: string, changedBy: string, note?: string): Promise<void> {
  const [asset] = await db.select({ status: itAssets.status }).from(itAssets).where(and(eq(itAssets.id, assetId), eq(itAssets.companyId, companyId))).limit(1);
  if (!asset) throw new ItError('Varlık bulunamadı.');
  await db.transaction(async (tx) => {
    await tx.update(itAssets).set({ status: toStatus as (typeof itAssets.$inferInsert)['status'] }).where(eq(itAssets.id, assetId));
    await tx.insert(itAssetStatusHistory).values({ id: newId(), assetId, fromStatus: asset.status, toStatus, changedBy, note });
  });
}

export interface AssignAssetInput {
  assetId: string;
  userId: string;
  assignmentType?: 'PERMANENT' | 'TEMPORARY' | 'SHARED';
  reason?: string;
}

// PDF madde 8 — bir cihaz zaman içinde birden fazla kullanıcıya atanabilir,
// GEÇMİŞİ korunur (returnedAt ile kapatılır, SİLİNMEZ).
export async function assignAsset(companyId: string, input: AssignAssetInput, assignedBy: string): Promise<void> {
  const [asset] = await db.select({ status: itAssets.status }).from(itAssets).where(and(eq(itAssets.id, input.assetId), eq(itAssets.companyId, companyId))).limit(1);
  if (!asset) throw new ItError('Varlık bulunamadı.');

  await db.transaction(async (tx) => {
    // Aktif (returnedAt IS NULL) bir atama varsa ÖNCE kapat — bir cihazın
    // aynı anda birden fazla AKTİF ataması olamaz. WHERE'e returnedAt IS NULL
    // ZORUNLU — aksi halde zaten kapalı (geçmiş) satırların returnedAt'ı da
    // "şimdi"ye üzerine yazılır, tarihçe bozulur.
    await tx
      .update(itAssetAssignments)
      .set({ returnedAt: new Date() })
      .where(and(eq(itAssetAssignments.assetId, input.assetId), isNull(itAssetAssignments.returnedAt)));
    await tx.insert(itAssetAssignments).values({
      id: newId(),
      assetId: input.assetId,
      userId: input.userId,
      assignmentType: input.assignmentType ?? 'PERMANENT',
      assignedBy,
      reason: input.reason
    });
    await tx.update(itAssets).set({ status: 'ASSIGNED', ownerUserId: input.userId }).where(eq(itAssets.id, input.assetId));
    await tx.insert(itAssetStatusHistory).values({ id: newId(), assetId: input.assetId, fromStatus: asset.status, toStatus: 'ASSIGNED', changedBy: assignedBy, note: `Kullanıcıya atandı.` });
  });
}

export async function listAssetAssignments(assetId: string) {
  return db
    .select({ id: itAssetAssignments.id, userId: itAssetAssignments.userId, userName: users.fullName, assignedAt: itAssetAssignments.assignedAt, returnedAt: itAssetAssignments.returnedAt, assignmentType: itAssetAssignments.assignmentType, reason: itAssetAssignments.reason })
    .from(itAssetAssignments)
    .innerJoin(users, eq(users.id, itAssetAssignments.userId))
    .where(eq(itAssetAssignments.assetId, assetId))
    .orderBy(desc(itAssetAssignments.assignedAt));
}

export async function listAssetStatusHistory(assetId: string) {
  return db.select().from(itAssetStatusHistory).where(eq(itAssetStatusHistory.assetId, assetId)).orderBy(desc(itAssetStatusHistory.createdAt));
}
