import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { boms, bomLines, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { ProductionError } from './errors';

// Holding ERP Faz 2 — BOM (Ürün Ağacı). employee_contracts/emp_compensations
// İLE AYNI immutable versiyon zinciri: aynı `code` ile yeni bir BOM
// oluşturulduğunda önceki ACTIVE SUPERSEDED'e döner, SİLİNMEZ. `code`
// KASITLI OLARAK productId'den AYRI (companyId+code+version unique) — bir
// ürünün aynı anda birden fazla BOM "kimliği" olabilir (ör. "yaz reçetesi"/
// "kış reçetesi"), kod içine tek-BOM-per-ürün varsayımı gömülmez.

export interface BomLineInput {
  componentProductId: string;
  quantity: number;
  unitId: string;
  scrapPercent?: number;
  alternativeComponentProductId?: string;
}

export interface CreateBomInput {
  productId: string;
  code: string;
  name: string;
  baseQuantity?: number;
  unitId: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  lines: BomLineInput[];
}

export async function createBom(companyId: string, createdByUserId: string, input: CreateBomInput): Promise<string> {
  if (input.lines.length === 0) throw new ProductionError('BOM\'da en az bir bileşen olmalı.');

  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.companyId, companyId))).limit(1);
    if (!product) throw new ProductionError('Ürün bulunamadı.');

    const [current] = await tx.select({ id: boms.id, version: boms.version }).from(boms).where(and(eq(boms.companyId, companyId), eq(boms.code, input.code), eq(boms.status, 'ACTIVE'))).limit(1);
    if (current) await tx.update(boms).set({ status: 'SUPERSEDED' }).where(eq(boms.id, current.id));

    const id = newId();
    await tx.insert(boms).values({
      id, companyId, productId: input.productId, code: input.code, name: input.name,
      version: current ? current.version + 1 : 1, baseQuantity: toDb(input.baseQuantity ?? 1), unitId: input.unitId,
      effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, supersedesId: current?.id, createdByUserId
    });

    let lineOrder = 0;
    for (const line of input.lines) {
      if (line.componentProductId === input.productId) throw new ProductionError('Bir ürün kendi bileşeni olamaz (döngüsel BOM).');
      const [component] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, line.componentProductId), eq(products.companyId, companyId))).limit(1);
      if (!component) throw new ProductionError('Bileşen ürün bulunamadı.');
      if (line.quantity <= 0) throw new ProductionError('Bileşen miktarı 0\'dan büyük olmalı.');

      await tx.insert(bomLines).values({
        id: newId(), bomId: id, lineOrder: lineOrder++, componentProductId: line.componentProductId, quantity: toDb(line.quantity),
        unitId: line.unitId, scrapPercent: line.scrapPercent === undefined ? undefined : toDb(line.scrapPercent), alternativeComponentProductId: line.alternativeComponentProductId
      });
    }

    return id;
  });
}

export async function listBoms(companyId: string, productId?: string) {
  const conditions = productId ? and(eq(boms.companyId, companyId), eq(boms.productId, productId)) : eq(boms.companyId, companyId);
  return db
    .select({ id: boms.id, code: boms.code, name: boms.name, version: boms.version, status: boms.status, productId: boms.productId, productName: products.name, createdAt: boms.createdAt })
    .from(boms)
    .innerJoin(products, eq(products.id, boms.productId))
    .where(conditions)
    .orderBy(desc(boms.createdAt));
}

export async function getBom(companyId: string, bomId: string) {
  const [bom] = await db.select().from(boms).where(and(eq(boms.id, bomId), eq(boms.companyId, companyId))).limit(1);
  if (!bom) throw new ProductionError('BOM bulunamadı.');
  const lines = await db
    .select({ id: bomLines.id, componentProductId: bomLines.componentProductId, componentName: products.name, quantity: bomLines.quantity, unitId: bomLines.unitId, scrapPercent: bomLines.scrapPercent, alternativeComponentProductId: bomLines.alternativeComponentProductId })
    .from(bomLines)
    .innerJoin(products, eq(products.id, bomLines.componentProductId))
    .where(eq(bomLines.bomId, bomId))
    .orderBy(bomLines.lineOrder);
  return { bom, lines };
}

// Üretim emri oluşturmanın TEK meşru yolu — her zaman o ürünün O ANDA
// geçerli (ACTIVE) BOM'unu çözer, kullanıcı elle bir versiyon SEÇMEZ
// (madde başındaki yorum: geçmiş bir emrin reçetesi donmuş kalır, ama YENİ
// bir emir her zaman güncel reçeteyi kullanır).
export async function getActiveBom(companyId: string, productId: string) {
  const [bom] = await db.select().from(boms).where(and(eq(boms.companyId, companyId), eq(boms.productId, productId), eq(boms.status, 'ACTIVE'))).limit(1);
  return bom ?? null;
}
