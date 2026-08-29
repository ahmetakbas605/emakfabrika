import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { units } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { CoreError } from '@/lib/core/errors';

export interface CreateUnitInput {
  code: string;
  name: string;
  baseUnitId?: string;
  conversionFactor?: number | string;
}

// PDF madde 21 — "base unit ve conversion factor mantığı". baseUnitId
// doluysa conversionFactor da ZORUNLU (1 bu birim = conversionFactor ×
// baseUnit) — ikisinden yalnızca biri dolu olamaz, tutarsız bir birim
// tanımının şemaya girmesini burada, tek girişte engelliyoruz.
export async function createUnit(companyId: string, input: CreateUnitInput): Promise<string> {
  if (input.baseUnitId && input.conversionFactor === undefined) throw new CoreError('Taban birim seçildiyse dönüşüm çarpanı da girilmeli.');
  if (!input.baseUnitId && input.conversionFactor !== undefined) throw new CoreError('Dönüşüm çarpanı yalnızca bir taban birim seçildiğinde anlamlı.');
  if (input.baseUnitId) {
    const [base] = await db.select({ id: units.id }).from(units).where(and(eq(units.id, input.baseUnitId), eq(units.companyId, companyId))).limit(1);
    if (!base) throw new CoreError('Taban birim bulunamadı.');
  }

  const id = newId();
  await db.insert(units).values({
    id,
    companyId,
    code: input.code,
    name: input.name,
    baseUnitId: input.baseUnitId,
    conversionFactor: input.conversionFactor === undefined ? undefined : toDb(input.conversionFactor)
  });
  return id;
}

export async function listUnits(companyId: string) {
  return db.select().from(units).where(and(eq(units.companyId, companyId), eq(units.active, true)));
}

// quantity, `fromUnitId` cinsinden bir miktar — `toUnitId` cinsine çevrilir.
// İkisi de AYNI taban birime (doğrudan veya kendisi taban birim olarak)
// indirgenebiliyorsa dönüşüm yapılır, aksi halde CoreError (ör. KG'yi
// ADET'e çevirmeye çalışmak gibi anlamsız bir dönüşüm).
export async function convertUnitQuantity(companyId: string, quantity: number | string, fromUnitId: string, toUnitId: string): Promise<string> {
  if (fromUnitId === toUnitId) return toDb(quantity);

  const rows = await db.select().from(units).where(eq(units.companyId, companyId));
  const byId = new Map(rows.map((u) => [u.id, u]));
  const from = byId.get(fromUnitId);
  const to = byId.get(toUnitId);
  if (!from || !to) throw new CoreError('Birim bulunamadı.');

  // Her birimi kendi taban birimine ve o tabana göre çarpanına indirger
  // (taban birimin kendisi için çarpan 1).
  function toBase(unit: NonNullable<typeof from>): { baseUnitId: string; factor: string } {
    if (!unit.baseUnitId) return { baseUnitId: unit.id, factor: '1' };
    return { baseUnitId: unit.baseUnitId, factor: unit.conversionFactor ?? '1' };
  }
  const fromBase = toBase(from);
  const toBaseResolved = toBase(to);
  if (fromBase.baseUnitId !== toBaseResolved.baseUnitId) throw new CoreError(`${from.code} ile ${to.code} birbirine dönüştürülemez (ortak taban birim yok).`);

  // quantity(from) × fromFactor = taban birim miktarı; taban / toFactor = quantity(to).
  const baseQty = money(quantity).times(money(fromBase.factor));
  const converted = baseQty.dividedBy(money(toBaseResolved.factor));
  return toDb(converted);
}
