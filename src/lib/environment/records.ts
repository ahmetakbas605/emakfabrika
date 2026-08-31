import 'server-only';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { envEmissionRecords, envWasteRecords } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';

export interface RecordEmissionInput {
  recordDate: string;
  emissionType: (typeof envEmissionRecords.$inferInsert)['emissionType'];
  quantity: number;
  unit: string;
  source?: string;
}

export async function recordEmission(companyId: string, userId: string, input: RecordEmissionInput): Promise<string> {
  const id = newId();
  await db.insert(envEmissionRecords).values({
    id, companyId, recordDate: input.recordDate, emissionType: input.emissionType, quantity: toDb(input.quantity), unit: input.unit,
    source: input.source ?? '', createdByUserId: userId
  });
  return id;
}

export async function listEmissions(companyId: string) {
  return db.select().from(envEmissionRecords).where(eq(envEmissionRecords.companyId, companyId)).orderBy(envEmissionRecords.recordDate);
}

export interface RecordWasteInput {
  recordDate: string;
  wasteType: (typeof envWasteRecords.$inferInsert)['wasteType'];
  quantity: number;
  unit: string;
  disposalMethod: (typeof envWasteRecords.$inferInsert)['disposalMethod'];
  disposalCompany?: string;
  notes?: string;
}

export async function recordWaste(companyId: string, userId: string, input: RecordWasteInput): Promise<string> {
  const id = newId();
  await db.insert(envWasteRecords).values({
    id, companyId, recordDate: input.recordDate, wasteType: input.wasteType, quantity: toDb(input.quantity), unit: input.unit,
    disposalMethod: input.disposalMethod, disposalCompany: input.disposalCompany ?? '', notes: input.notes, createdByUserId: userId
  });
  return id;
}

export async function listWaste(companyId: string) {
  return db.select().from(envWasteRecords).where(eq(envWasteRecords.companyId, companyId)).orderBy(envWasteRecords.recordDate);
}

export interface EnvironmentalSummary {
  fromDate: string;
  toDate: string;
  emissionByType: Record<string, number>;
  wasteByType: Record<string, number>;
}

// lib/eam/energy.ts:getEnergyPerUnit'ten bu yana bu oturumda tekrar tekrar
// uygulanan "talep üzerine hesaplanan rapor" ailesinin bir dönem-bazlı
// toplama varyantı — emisyon/atık TİPİNE göre gruplanmış toplamlar.
export async function getEnvironmentalSummary(companyId: string, fromDate: string, toDate: string): Promise<EnvironmentalSummary> {
  const emissions = await db
    .select({ emissionType: envEmissionRecords.emissionType, quantity: envEmissionRecords.quantity })
    .from(envEmissionRecords)
    .where(and(eq(envEmissionRecords.companyId, companyId), gte(envEmissionRecords.recordDate, fromDate), lte(envEmissionRecords.recordDate, toDate)));

  const wastes = await db
    .select({ wasteType: envWasteRecords.wasteType, quantity: envWasteRecords.quantity })
    .from(envWasteRecords)
    .where(and(eq(envWasteRecords.companyId, companyId), gte(envWasteRecords.recordDate, fromDate), lte(envWasteRecords.recordDate, toDate)));

  const emissionByType: Record<string, number> = {};
  for (const e of emissions) {
    emissionByType[e.emissionType] = money(emissionByType[e.emissionType] ?? 0).plus(money(e.quantity)).toNumber();
  }

  const wasteByType: Record<string, number> = {};
  for (const w of wastes) {
    wasteByType[w.wasteType] = money(wasteByType[w.wasteType] ?? 0).plus(money(w.quantity)).toNumber();
  }

  return { fromDate, toDate, emissionByType, wasteByType };
}
