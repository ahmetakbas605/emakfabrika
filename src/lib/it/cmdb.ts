import 'server-only';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { configurationItems, ciRelationships, ciKeyCounters, itAssets, itAssetTypes } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// CMDB.md — IT-DATABASE.md §4'teki bilinçli karar: her it_assets satırı
// OTOMATİK bir CI değildir, yalnızca dependency/impact analizi gereken
// varlıklar CI'ya "yükseltilir."

// PDF madde 5 örnekleri (SERVER-001, SWITCH-003) — lib/accounting.ts:
// nextJournalNo ile AYNI atomik-sayaç deseni, asset_type_code bazında.
export async function promoteAssetToCI(companyId: string, assetId: string): Promise<string> {
  const [asset] = await db.select({ name: itAssets.name, assetTypeCode: itAssets.assetTypeCode }).from(itAssets).where(and(eq(itAssets.id, assetId), eq(itAssets.companyId, companyId))).limit(1);
  if (!asset) throw new ItError('Varlık bulunamadı.');

  const [existing] = await db.select({ id: configurationItems.id }).from(configurationItems).where(eq(configurationItems.linkedAssetId, assetId)).limit(1);
  if (existing) throw new ItError('Bu varlık zaten bir CMDB kaydına (CI) sahip.');

  return db.transaction(async (tx) => {
    await tx.insert(ciKeyCounters).values({ companyId, assetTypeCode: asset.assetTypeCode, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
    await tx
      .update(ciKeyCounters)
      .set({ lastNumber: sql`${ciKeyCounters.lastNumber} + 1` })
      .where(and(eq(ciKeyCounters.companyId, companyId), eq(ciKeyCounters.assetTypeCode, asset.assetTypeCode)));
    const [counter] = await tx
      .select({ lastNumber: ciKeyCounters.lastNumber })
      .from(ciKeyCounters)
      .where(and(eq(ciKeyCounters.companyId, companyId), eq(ciKeyCounters.assetTypeCode, asset.assetTypeCode)))
      .limit(1);
    const ciKey = `${asset.assetTypeCode}-${String(counter.lastNumber).padStart(3, '0')}`;

    const id = newId();
    await tx.insert(configurationItems).values({ id, companyId, ciType: 'ASSET', linkedAssetId: assetId, name: asset.name, ciKey });
    return id;
  });
}

export interface RelationshipListRow {
  id: string;
  relationshipType: string;
  sourceCiKey: string;
  sourceCiName: string;
  targetCiKey: string;
  targetCiName: string;
}

export async function listRelationships(companyId: string): Promise<RelationshipListRow[]> {
  const sourceCi = configurationItems;
  const rows = await db
    .select({
      id: ciRelationships.id,
      relationshipType: ciRelationships.relationshipType,
      sourceCiKey: sourceCi.ciKey,
      sourceCiName: sourceCi.name,
      targetCiId: ciRelationships.targetCiId
    })
    .from(ciRelationships)
    .innerJoin(sourceCi, eq(sourceCi.id, ciRelationships.sourceCiId))
    .where(eq(sourceCi.companyId, companyId));

  const targetIds = [...new Set(rows.map((r) => r.targetCiId))];
  if (targetIds.length === 0) return [];
  const targets = await db.select({ id: configurationItems.id, ciKey: configurationItems.ciKey, name: configurationItems.name }).from(configurationItems);
  const targetById = new Map(targets.map((t) => [t.id, t]));

  return rows.map((r) => {
    const target = targetById.get(r.targetCiId);
    return { id: r.id, relationshipType: r.relationshipType, sourceCiKey: r.sourceCiKey, sourceCiName: r.sourceCiName, targetCiKey: target?.ciKey ?? '?', targetCiName: target?.name ?? '?' };
  });
}

export async function listConfigurationItems(companyId: string) {
  return db
    .select({ id: configurationItems.id, ciKey: configurationItems.ciKey, name: configurationItems.name, ciType: configurationItems.ciType, status: configurationItems.status, assetTypeName: itAssetTypes.name })
    .from(configurationItems)
    .leftJoin(itAssets, eq(itAssets.id, configurationItems.linkedAssetId))
    .leftJoin(itAssetTypes, eq(itAssetTypes.code, itAssets.assetTypeCode))
    .where(eq(configurationItems.companyId, companyId));
}

export interface CreateRelationshipInput {
  sourceCiId: string;
  targetCiId: string;
  relationshipType: string;
}

export async function createRelationship(input: CreateRelationshipInput): Promise<string> {
  if (input.sourceCiId === input.targetCiId) throw new ItError('Bir CI kendisiyle ilişkilendirilemez.');
  const id = newId();
  await db.insert(ciRelationships).values({ id, sourceCiId: input.sourceCiId, targetCiId: input.targetCiId, relationshipType: input.relationshipType as (typeof ciRelationships.$inferInsert)['relationshipType'] });
  return id;
}

export interface RelationshipRow {
  id: string;
  relationshipType: string;
  ciId: string;
  ciKey: string;
  ciName: string;
}

// CMDB.md §2 — bu CI'nın NEYE bağımlı olduğu (source=ciId).
export async function getDependencies(ciId: string): Promise<RelationshipRow[]> {
  return db
    .select({ id: ciRelationships.id, relationshipType: ciRelationships.relationshipType, ciId: configurationItems.id, ciKey: configurationItems.ciKey, ciName: configurationItems.name })
    .from(ciRelationships)
    .innerJoin(configurationItems, eq(configurationItems.id, ciRelationships.targetCiId))
    .where(eq(ciRelationships.sourceCiId, ciId));
}

// KİMİN bu CI'ya bağımlı olduğu (target=ciId).
export async function getDependents(ciId: string): Promise<RelationshipRow[]> {
  return db
    .select({ id: ciRelationships.id, relationshipType: ciRelationships.relationshipType, ciId: configurationItems.id, ciKey: configurationItems.ciKey, ciName: configurationItems.name })
    .from(ciRelationships)
    .innerJoin(configurationItems, eq(configurationItems.id, ciRelationships.sourceCiId))
    .where(eq(ciRelationships.targetCiId, ciId));
}

// CMDB.md §3 — impact analizi: bu CI etkilendiğinde ZİNCİRLEME kimler
// etkilenir (getDependents'in recursive versiyonu). Çevrimsel ilişkiye
// karşı korunmalı (ziyaret edilen CI'lar bir Set'te tutulur) — max derinlik
// de ayrıca sınırlanıyor, olası bir veri hatasının sonsuz döngüye
// dönüşmemesi için.
const MAX_TRAVERSAL_DEPTH = 10;

export async function getImpactedCiIds(companyId: string, ciId: string): Promise<string[]> {
  void companyId; // ileride business_services filtrelemesi için — Faz 5'in temel sürümünde henüz yok.
  const visited = new Set<string>([ciId]);
  let frontier = [ciId];
  for (let depth = 0; depth < MAX_TRAVERSAL_DEPTH && frontier.length > 0; depth++) {
    const nextFrontier: string[] = [];
    for (const current of frontier) {
      const dependents = await getDependents(current);
      for (const dep of dependents) {
        if (!visited.has(dep.ciId)) {
          visited.add(dep.ciId);
          nextFrontier.push(dep.ciId);
        }
      }
    }
    frontier = nextFrontier;
  }
  visited.delete(ciId);
  return [...visited];
}
