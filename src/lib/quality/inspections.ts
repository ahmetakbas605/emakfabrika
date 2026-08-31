import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { qualityInspections, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { money, toDb } from '@/lib/money';
import { QualityError } from './errors';

// Holding ERP Faz 5 (Kalite) — Giriş/Proses/Final muayene, TEK adımda
// kaydedilir (lib/mes/downtime.ts'nin başlat/bitir iki-adımlı deseninin
// AKSİNE — bir muayenenin süresi anlamlı bir veri DEĞİL, tek bir gözlem
// anıdır, recordStockMovement'ın tek-adımlı deseniyle AYNI mantık).

export interface RecordInspectionInput {
  type: (typeof qualityInspections.$inferInsert)['type'];
  sourceType: string;
  sourceId: string;
  productId?: string;
  inspectedQty: number;
  passedQty: number;
  failedQty: number;
  result: (typeof qualityInspections.$inferInsert)['result'];
  notes?: string;
}

export async function recordInspection(companyId: string, userId: string, input: RecordInspectionInput): Promise<string> {
  if (!money(input.passedQty).plus(money(input.failedQty)).equals(money(input.inspectedQty))) {
    throw new QualityError('Geçen + Kalan miktar, muayene edilen miktara eşit olmalı.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const inspectionNo = await nextDocumentNo(tx, companyId, 'QI', 'MUY', new Date().getFullYear(), 6);
    await tx.insert(qualityInspections).values({
      id, companyId, inspectionNo, type: input.type, sourceType: input.sourceType, sourceId: input.sourceId, productId: input.productId,
      inspectedQty: toDb(input.inspectedQty), passedQty: toDb(input.passedQty), failedQty: toDb(input.failedQty),
      result: input.result, notes: input.notes, inspectedByUserId: userId
    });
    return id;
  });
}

export interface ListInspectionsFilter {
  type?: (typeof qualityInspections.$inferInsert)['type'];
  result?: (typeof qualityInspections.$inferInsert)['result'];
}

export async function listInspections(companyId: string, filter?: ListInspectionsFilter) {
  const conditions = [eq(qualityInspections.companyId, companyId)];
  if (filter?.type) conditions.push(eq(qualityInspections.type, filter.type));
  if (filter?.result) conditions.push(eq(qualityInspections.result, filter.result));
  return db
    .select({
      id: qualityInspections.id, inspectionNo: qualityInspections.inspectionNo, type: qualityInspections.type,
      sourceType: qualityInspections.sourceType, sourceId: qualityInspections.sourceId, productName: products.name,
      inspectedQty: qualityInspections.inspectedQty, passedQty: qualityInspections.passedQty, failedQty: qualityInspections.failedQty,
      result: qualityInspections.result, inspectedAt: qualityInspections.inspectedAt
    })
    .from(qualityInspections)
    .leftJoin(products, eq(products.id, qualityInspections.productId))
    .where(and(...conditions))
    .orderBy(desc(qualityInspections.inspectedAt));
}

export async function getInspection(companyId: string, inspectionId: string) {
  const [row] = await db.select().from(qualityInspections).where(and(eq(qualityInspections.id, inspectionId), eq(qualityInspections.companyId, companyId))).limit(1);
  if (!row) throw new QualityError('Muayene kaydı bulunamadı.');
  return row;
}
