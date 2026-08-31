import 'server-only';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { energyMeters, energyReadings, workCenters, prodOperations, productionOrders } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { EamError } from './errors';

// Holding ERP Faz 6 (Enerji) — elektrik/doğalgaz/su/buhar/basınçlı hava
// tüketim takibi + ürün-başı enerji hesaplaması.

export interface CreateEnergyMeterInput {
  code: string;
  name: string;
  energyType: (typeof energyMeters.$inferInsert)['energyType'];
  unit: string;
  workCenterId?: string;
  eamAssetId?: string;
}

export async function createEnergyMeter(companyId: string, input: CreateEnergyMeterInput): Promise<string> {
  const id = newId();
  await db.insert(energyMeters).values({
    id, companyId, code: input.code, name: input.name, energyType: input.energyType, unit: input.unit,
    workCenterId: input.workCenterId, eamAssetId: input.eamAssetId
  });
  return id;
}

export async function listEnergyMeters(companyId: string) {
  return db
    .select({
      id: energyMeters.id, code: energyMeters.code, name: energyMeters.name, energyType: energyMeters.energyType, unit: energyMeters.unit,
      workCenterId: energyMeters.workCenterId, workCenterName: workCenters.name
    })
    .from(energyMeters)
    .leftJoin(workCenters, eq(workCenters.id, energyMeters.workCenterId))
    .where(and(eq(energyMeters.companyId, companyId), eq(energyMeters.active, true)));
}

export interface RecordEnergyReadingInput {
  meterId: string;
  periodStart: string;
  periodEnd: string;
  consumption: number;
  cost?: number;
}

export async function recordEnergyReading(companyId: string, userId: string, input: RecordEnergyReadingInput): Promise<string> {
  const [meter] = await db.select({ id: energyMeters.id }).from(energyMeters).where(and(eq(energyMeters.id, input.meterId), eq(energyMeters.companyId, companyId))).limit(1);
  if (!meter) throw new EamError('Sayaç bulunamadı.');
  if (input.periodEnd < input.periodStart) throw new EamError('Dönem bitişi başlangıçtan önce olamaz.');

  const id = newId();
  await db.insert(energyReadings).values({
    id, companyId, meterId: input.meterId, periodStart: input.periodStart, periodEnd: input.periodEnd,
    consumption: toDb(input.consumption), cost: input.cost === undefined ? undefined : toDb(input.cost), recordedByUserId: userId
  });
  return id;
}

export async function listEnergyReadings(companyId: string, meterId?: string) {
  const conditions = meterId ? and(eq(energyReadings.companyId, companyId), eq(energyReadings.meterId, meterId)) : eq(energyReadings.companyId, companyId);
  return db
    .select({
      id: energyReadings.id, meterId: energyReadings.meterId, meterName: energyMeters.name, energyType: energyMeters.energyType, unit: energyMeters.unit,
      periodStart: energyReadings.periodStart, periodEnd: energyReadings.periodEnd, consumption: energyReadings.consumption, cost: energyReadings.cost
    })
    .from(energyReadings)
    .innerJoin(energyMeters, eq(energyMeters.id, energyReadings.meterId))
    .where(conditions)
    .orderBy(desc(energyReadings.periodStart));
}

export interface EnergyPerUnitResult {
  workCenterId: string;
  fromDate: string;
  toDate: string;
  totalConsumption: number;
  totalCost: number;
  totalGoodQuantity: number;
  energyPerUnit: number | null;
}

// lib/mes/oee.ts + lib/quality/supplier-score.ts İLE AYNI ÜÇÜNCÜ
// uygulaması: SAKLANAN bir alan DEĞİL, TALEP ÜZERİNE hesaplanan bir rapor.
// "Dönem TAMAMEN [fromDate,toDate] içinde kalan" okumalar toplanır (kısmi
// çakışan bir dönemi PRO-RATA bölmek bu fazın kapsamına orantısız karmaşıklık
// katardı — dürüstçe not edilen bir basitleştirme).
export async function getEnergyPerUnit(companyId: string, workCenterId: string, fromDate: string, toDate: string): Promise<EnergyPerUnitResult> {
  const meters = await db.select({ id: energyMeters.id }).from(energyMeters).where(and(eq(energyMeters.companyId, companyId), eq(energyMeters.workCenterId, workCenterId)));
  const meterIds = meters.map((m) => m.id);

  let totalConsumption = money(0);
  let totalCost = money(0);
  if (meterIds.length > 0) {
    const readings = await db
      .select({ consumption: energyReadings.consumption, cost: energyReadings.cost })
      .from(energyReadings)
      .where(and(inArray(energyReadings.meterId, meterIds), gte(energyReadings.periodStart, fromDate), lte(energyReadings.periodEnd, toDate)));
    for (const r of readings) {
      totalConsumption = totalConsumption.plus(money(r.consumption));
      totalCost = totalCost.plus(money(r.cost ?? 0));
    }
  }

  const operations = await db
    .select({ goodQuantity: prodOperations.goodQuantity })
    .from(prodOperations)
    .innerJoin(productionOrders, eq(productionOrders.id, prodOperations.orderId))
    .where(and(eq(prodOperations.companyId, companyId), eq(prodOperations.workCenterId, workCenterId), eq(prodOperations.status, 'COMPLETED'), gte(prodOperations.completedAt, new Date(fromDate)), lte(prodOperations.completedAt, new Date(`${toDate}T23:59:59`))));

  const totalGoodQuantity = operations.reduce((acc, o) => acc.plus(money(o.goodQuantity)), money(0));
  const energyPerUnit = totalGoodQuantity.greaterThan(0) ? totalConsumption.dividedBy(totalGoodQuantity).toNumber() : null;

  return {
    workCenterId, fromDate, toDate, totalConsumption: totalConsumption.toNumber(), totalCost: totalCost.toNumber(),
    totalGoodQuantity: totalGoodQuantity.toNumber(), energyPerUnit
  };
}
