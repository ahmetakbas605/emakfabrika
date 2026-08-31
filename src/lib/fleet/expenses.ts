import 'server-only';
import { eq, and, desc, gte, lte, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { vehicleExpenses, vehicles } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { FleetError } from './errors';

export interface RecordVehicleExpenseInput {
  vehicleId: string;
  expenseType: (typeof vehicleExpenses.$inferInsert)['expenseType'];
  expenseDate: string;
  amount: number;
  quantity?: number;
  odometerKm?: number;
  notes?: string;
}

export async function recordVehicleExpense(companyId: string, userId: string, input: RecordVehicleExpenseInput): Promise<string> {
  const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.companyId, companyId))).limit(1);
  if (!vehicle) throw new FleetError('Araç bulunamadı.');

  const id = newId();
  await db.insert(vehicleExpenses).values({
    id, companyId, vehicleId: input.vehicleId, expenseType: input.expenseType, expenseDate: input.expenseDate, amount: toDb(input.amount),
    quantity: input.quantity === undefined ? undefined : toDb(input.quantity), odometerKm: input.odometerKm === undefined ? undefined : String(input.odometerKm),
    notes: input.notes, createdByUserId: userId
  });
  return id;
}

export async function listVehicleExpenses(companyId: string, vehicleId?: string) {
  const conditions = vehicleId ? and(eq(vehicleExpenses.companyId, companyId), eq(vehicleExpenses.vehicleId, vehicleId)) : eq(vehicleExpenses.companyId, companyId);
  return db
    .select({
      id: vehicleExpenses.id, vehicleId: vehicleExpenses.vehicleId, plateNo: vehicles.plateNo, expenseType: vehicleExpenses.expenseType,
      expenseDate: vehicleExpenses.expenseDate, amount: vehicleExpenses.amount, quantity: vehicleExpenses.quantity, odometerKm: vehicleExpenses.odometerKm
    })
    .from(vehicleExpenses)
    .innerJoin(vehicles, eq(vehicles.id, vehicleExpenses.vehicleId))
    .where(conditions)
    .orderBy(desc(vehicleExpenses.expenseDate));
}

export interface FuelEfficiencyResult {
  vehicleId: string;
  fromDate: string;
  toDate: string;
  totalFuelAmount: number;
  totalFuelLiters: number;
  avgCostPerLiter: number | null;
  totalKm: number | null;
  kmPerLiter: number | null;
}

// lib/eam/energy.ts:getEnergyPerUnit İLE AYNI BEŞİNCİ (bu oturumda dördüncü
// sayılırsa da — OEE/tedarikçi-kalite/enerji'den sonra) "saklanan alan
// değil, talep üzerine hesaplanan rapor" uygulaması. kmPerLiter YALNIZCA
// aralıkta EN AZ İKİ kilometre okuması varsa hesaplanır (tek okumadan
// mesafe TÜRETİLEMEZ) — dürüstçe null döner, Faz 4/5/6'daki "makine ideal
// çevrim süresi tanımsızsa Performance=null" İLE AYNI dürüst-null ilkesi.
export async function getVehicleFuelEfficiency(companyId: string, vehicleId: string, fromDate: string, toDate: string): Promise<FuelEfficiencyResult> {
  const fuelExpenses = await db
    .select({ amount: vehicleExpenses.amount, quantity: vehicleExpenses.quantity, odometerKm: vehicleExpenses.odometerKm, expenseDate: vehicleExpenses.expenseDate })
    .from(vehicleExpenses)
    .where(and(eq(vehicleExpenses.companyId, companyId), eq(vehicleExpenses.vehicleId, vehicleId), eq(vehicleExpenses.expenseType, 'FUEL'), gte(vehicleExpenses.expenseDate, fromDate), lte(vehicleExpenses.expenseDate, toDate)))
    .orderBy(asc(vehicleExpenses.expenseDate));

  const totalFuelAmount = fuelExpenses.reduce((acc, e) => acc.plus(money(e.amount)), money(0));
  const totalFuelLiters = fuelExpenses.reduce((acc, e) => acc.plus(money(e.quantity ?? 0)), money(0));
  const avgCostPerLiter = totalFuelLiters.greaterThan(0) ? totalFuelAmount.dividedBy(totalFuelLiters).toNumber() : null;

  const odometerReadings = fuelExpenses.filter((e) => e.odometerKm !== null).map((e) => money(e.odometerKm as string));
  let totalKm: number | null = null;
  if (odometerReadings.length >= 2) {
    const first = odometerReadings[0];
    const last = odometerReadings[odometerReadings.length - 1];
    if (last.greaterThan(first)) totalKm = last.minus(first).toNumber();
  }
  const kmPerLiter = totalKm !== null && totalFuelLiters.greaterThan(0) ? money(totalKm).dividedBy(totalFuelLiters).toNumber() : null;

  return { vehicleId, fromDate, toDate, totalFuelAmount: totalFuelAmount.toNumber(), totalFuelLiters: totalFuelLiters.toNumber(), avgCostPerLiter, totalKm, kmPerLiter };
}
