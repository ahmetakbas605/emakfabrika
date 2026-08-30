import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { routings, routingOperations, products, workCenters } from '@/db/schema';
import { newId } from '@/lib/id';
import { ProductionError } from './errors';

// Holding ERP Faz 2 — Routing (Rota). lib/production/bom.ts İLE AYNI
// immutable versiyon zinciri deseni. Routing OPSİYONELDİR — bir üretim
// emri routing OLMADAN da (iş emri üretilmeden) doğrudan malzeme
// çıkışı→tamamlama akışıyla ilerleyebilir.

export interface RoutingOperationInput {
  workCenterId: string;
  name: string;
  setupTimeMinutes?: number;
  runTimeMinutesPerUnit?: number;
  description?: string;
}

export interface CreateRoutingInput {
  productId: string;
  code: string;
  name: string;
  operations: RoutingOperationInput[];
}

export async function createRouting(companyId: string, createdByUserId: string, input: CreateRoutingInput): Promise<string> {
  if (input.operations.length === 0) throw new ProductionError('Routing\'te en az bir operasyon olmalı.');

  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.companyId, companyId))).limit(1);
    if (!product) throw new ProductionError('Ürün bulunamadı.');

    const [current] = await tx.select({ id: routings.id, version: routings.version }).from(routings).where(and(eq(routings.companyId, companyId), eq(routings.code, input.code), eq(routings.status, 'ACTIVE'))).limit(1);
    if (current) await tx.update(routings).set({ status: 'SUPERSEDED' }).where(eq(routings.id, current.id));

    const id = newId();
    await tx.insert(routings).values({ id, companyId, productId: input.productId, code: input.code, name: input.name, version: current ? current.version + 1 : 1, supersedesId: current?.id, createdByUserId });

    let operationOrder = 1;
    for (const op of input.operations) {
      const [workCenter] = await tx.select({ id: workCenters.id }).from(workCenters).where(and(eq(workCenters.id, op.workCenterId), eq(workCenters.companyId, companyId))).limit(1);
      if (!workCenter) throw new ProductionError('İş merkezi bulunamadı.');

      await tx.insert(routingOperations).values({
        id: newId(), routingId: id, operationOrder: operationOrder++, workCenterId: op.workCenterId, name: op.name,
        setupTimeMinutes: op.setupTimeMinutes === undefined ? undefined : String(op.setupTimeMinutes),
        runTimeMinutesPerUnit: op.runTimeMinutesPerUnit === undefined ? undefined : String(op.runTimeMinutesPerUnit),
        description: op.description
      });
    }

    return id;
  });
}

export async function listRoutings(companyId: string, productId?: string) {
  const conditions = productId ? and(eq(routings.companyId, companyId), eq(routings.productId, productId)) : eq(routings.companyId, companyId);
  return db
    .select({ id: routings.id, code: routings.code, name: routings.name, version: routings.version, status: routings.status, productId: routings.productId, productName: products.name, createdAt: routings.createdAt })
    .from(routings)
    .innerJoin(products, eq(products.id, routings.productId))
    .where(conditions)
    .orderBy(desc(routings.createdAt));
}

export async function getRouting(companyId: string, routingId: string) {
  const [routing] = await db.select().from(routings).where(and(eq(routings.id, routingId), eq(routings.companyId, companyId))).limit(1);
  if (!routing) throw new ProductionError('Routing bulunamadı.');
  const operations = await db
    .select({ id: routingOperations.id, operationOrder: routingOperations.operationOrder, workCenterId: routingOperations.workCenterId, workCenterName: workCenters.name, name: routingOperations.name, setupTimeMinutes: routingOperations.setupTimeMinutes, runTimeMinutesPerUnit: routingOperations.runTimeMinutesPerUnit })
    .from(routingOperations)
    .innerJoin(workCenters, eq(workCenters.id, routingOperations.workCenterId))
    .where(eq(routingOperations.routingId, routingId))
    .orderBy(routingOperations.operationOrder);
  return { routing, operations };
}

export async function getActiveRouting(companyId: string, productId: string) {
  const [routing] = await db.select().from(routings).where(and(eq(routings.companyId, companyId), eq(routings.productId, productId), eq(routings.status, 'ACTIVE'))).limit(1);
  return routing ?? null;
}
