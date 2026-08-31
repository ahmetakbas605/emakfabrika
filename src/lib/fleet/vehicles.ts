import 'server-only';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { vehicles, vehicleInsurances, departments } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { FleetError } from './errors';

export interface CreateVehicleInput {
  plateNo: string;
  brand?: string;
  model?: string;
  year?: number;
  vin?: string;
  fuelType?: (typeof vehicles.$inferInsert)['fuelType'];
  registrationExpiryDate?: string;
  responsibleUserId?: string;
  departmentId?: string;
  purchaseDate?: string;
  purchaseCost?: number;
}

export async function createVehicle(companyId: string, input: CreateVehicleInput): Promise<string> {
  const id = newId();
  await db.insert(vehicles).values({
    id, companyId, plateNo: input.plateNo, brand: input.brand ?? '', model: input.model ?? '', year: input.year, vin: input.vin ?? '',
    fuelType: input.fuelType, registrationExpiryDate: input.registrationExpiryDate, responsibleUserId: input.responsibleUserId,
    departmentId: input.departmentId, purchaseDate: input.purchaseDate, purchaseCost: input.purchaseCost === undefined ? undefined : toDb(input.purchaseCost)
  });
  return id;
}

export async function listVehicles(companyId: string) {
  return db
    .select({
      id: vehicles.id, plateNo: vehicles.plateNo, brand: vehicles.brand, model: vehicles.model, fuelType: vehicles.fuelType,
      status: vehicles.status, registrationExpiryDate: vehicles.registrationExpiryDate, departmentName: departments.name
    })
    .from(vehicles)
    .leftJoin(departments, eq(departments.id, vehicles.departmentId))
    .where(eq(vehicles.companyId, companyId))
    .orderBy(vehicles.plateNo);
}

export async function getVehicle(companyId: string, vehicleId: string) {
  const [row] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.companyId, companyId))).limit(1);
  if (!row) throw new FleetError('Araç bulunamadı.');
  return row;
}

// MAINTENANCE.md §4'ün changeAssetStatus'uyla AYNI amaç — lib/eam/
// assets.ts:changeEamAssetStatus İLE AYNI gerekçeyle kendi durum-geçmişi
// tablosu KURULMADI (bu fazın kapsamı bir denetim izi gerektirmiyor).
export async function changeVehicleStatus(companyId: string, vehicleId: string, status: (typeof vehicles.$inferInsert)['status']): Promise<void> {
  await getVehicle(companyId, vehicleId);
  await db.update(vehicles).set({ status }).where(eq(vehicles.id, vehicleId));
}

export interface CreateVehicleInsuranceInput {
  vehicleId: string;
  policyNo: string;
  provider?: string;
  coverageType?: string;
  startDate: string;
  endDate: string;
  premium?: number;
}

export async function createVehicleInsurance(companyId: string, input: CreateVehicleInsuranceInput): Promise<string> {
  await getVehicle(companyId, input.vehicleId);
  if (input.endDate < input.startDate) throw new FleetError('Poliçe bitiş tarihi başlangıçtan önce olamaz.');

  const id = newId();
  await db.insert(vehicleInsurances).values({
    id, companyId, vehicleId: input.vehicleId, policyNo: input.policyNo, provider: input.provider ?? '', coverageType: input.coverageType ?? '',
    startDate: input.startDate, endDate: input.endDate, premium: input.premium === undefined ? undefined : toDb(input.premium)
  });
  return id;
}

export async function listVehicleInsurances(companyId: string, vehicleId?: string) {
  const conditions = vehicleId ? and(eq(vehicleInsurances.companyId, companyId), eq(vehicleInsurances.vehicleId, vehicleId)) : eq(vehicleInsurances.companyId, companyId);
  return db
    .select({
      id: vehicleInsurances.id, vehicleId: vehicleInsurances.vehicleId, plateNo: vehicles.plateNo, policyNo: vehicleInsurances.policyNo,
      provider: vehicleInsurances.provider, coverageType: vehicleInsurances.coverageType, startDate: vehicleInsurances.startDate,
      endDate: vehicleInsurances.endDate, premium: vehicleInsurances.premium
    })
    .from(vehicleInsurances)
    .innerJoin(vehicles, eq(vehicles.id, vehicleInsurances.vehicleId))
    .where(conditions)
    .orderBy(desc(vehicleInsurances.endDate));
}

export interface ExpiringDocument {
  vehicleId: string;
  plateNo: string;
  documentType: 'REGISTRATION' | 'INSURANCE';
  expiryDate: string;
  detail: string;
}

// Ruhsat + sigorta poliçelerinin YAKLAŞAN sona erme tarihlerini TEK bir
// listede toplayan bir rapor — lib/mes/oee.ts'den bu yana bu oturumun
// DÖRDÜNCÜ "saklanan alan değil, talep üzerine hesaplanan rapor"
// uygulaması (madde 3'ün bu kez zaman-bazlı bir uyarı biçimi).
export async function listExpiringVehicleDocuments(companyId: string, withinDays: number): Promise<ExpiringDocument[]> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const expiringVehicles = await db
    .select({ id: vehicles.id, plateNo: vehicles.plateNo, registrationExpiryDate: vehicles.registrationExpiryDate })
    .from(vehicles)
    .where(and(eq(vehicles.companyId, companyId), gte(vehicles.registrationExpiryDate, today), lte(vehicles.registrationExpiryDate, horizon)));

  const expiringInsurances = await db
    .select({ vehicleId: vehicleInsurances.vehicleId, plateNo: vehicles.plateNo, policyNo: vehicleInsurances.policyNo, endDate: vehicleInsurances.endDate })
    .from(vehicleInsurances)
    .innerJoin(vehicles, eq(vehicles.id, vehicleInsurances.vehicleId))
    .where(and(eq(vehicleInsurances.companyId, companyId), gte(vehicleInsurances.endDate, today), lte(vehicleInsurances.endDate, horizon)));

  const result: ExpiringDocument[] = [];
  for (const v of expiringVehicles) {
    if (v.registrationExpiryDate) result.push({ vehicleId: v.id, plateNo: v.plateNo, documentType: 'REGISTRATION', expiryDate: v.registrationExpiryDate, detail: 'Ruhsat' });
  }
  for (const i of expiringInsurances) {
    result.push({ vehicleId: i.vehicleId, plateNo: i.plateNo, documentType: 'INSURANCE', expiryDate: i.endDate, detail: `Sigorta — ${i.policyNo}` });
  }
  return result.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}
