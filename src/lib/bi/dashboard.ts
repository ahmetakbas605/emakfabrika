import 'server-only';
import { eq, and, ne, isNull, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { productionOrders, salesOrders, ncrRecords, safetyIncidents, machineDowntimes, eamAssets, salesInvoices, procVinvoices, legalCollaterals } from '@/db/schema';
import { getFinancialStatements } from '@/lib/accounting';
import { getCashFlowForecast } from '@/lib/treasury/cashflow';
import { getFxExposure, type FxExposureRow } from '@/lib/treasury/fx';
import { getAlertCenterItems } from './alerts';
import { getExpirationAlerts } from './expiration';

// Holding ERP Faz 12 (BI) — madde 564'ün CEO/Fabrika Müdürü/CFO/BT Müdürü
// dashboard'ları. BT Müdürü'nün KENDİ dashboard'u zaten Faz 10'dan (bkz.
// lib/it/dashboard.ts, /dashboard/departments/[id]/it/dashboard) var —
// burada TEKRARLANMADI. Diğer üçü genel bir "rapor tablosu" GEREKTİRMİYOR
// (bu oturumun OEE'den beri tekrar tekrar uyguladığı "talep üzerine
// hesaplanan rapor" ilkesi) — hepsi ya COUNT/GROUP BY (it/dashboard.ts'in
// AYNI ucuz-toplama deseni) ya da ZATEN var olan modül fonksiyonlarının
// (getFinancialStatements/getCashFlowForecast/getFxExposure) doğrudan
// yeniden kullanımı.
//
// Üçü de company-geneli veri döndürür — procurement/dashboard.ts'in "şirket
// geneli veri = yalnızca fabrika yöneticisi" kararıyla AYNI ilke, bu yüzden
// çağıran sayfa requireFactoryAdmin ile korunmalı (route seviyesinde).

export interface ExecutiveSummary {
  totalRevenue: string;
  totalExpense: string;
  netIncome: string;
  totalAssets: string;
  openSalesOrdersCount: number;
  productionOrdersInProgressCount: number;
  openNcrCount: number;
  openSafetyIncidentsCount: number;
  currentCash: number;
  highAlertCount: number;
  mediumAlertCount: number;
  expiringSoonCount: number;
}

export async function getExecutiveSummary(companyId: string): Promise<ExecutiveSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const [financials, forecast, alerts, expiring, openSalesOrders, productionInProgress, openNcr, openSafety] = await Promise.all([
    getFinancialStatements(companyId),
    getCashFlowForecast(companyId, today, today),
    getAlertCenterItems(companyId),
    getExpirationAlerts(companyId, 30),
    db.select({ value: sql<number>`COUNT(*)` }).from(salesOrders).where(and(eq(salesOrders.companyId, companyId), inArray(salesOrders.status, ['SUBMITTED', 'CONFIRMED', 'IN_FULFILLMENT']))),
    db.select({ value: sql<number>`COUNT(*)` }).from(productionOrders).where(and(eq(productionOrders.companyId, companyId), eq(productionOrders.status, 'IN_PROGRESS'))),
    db.select({ value: sql<number>`COUNT(*)` }).from(ncrRecords).where(and(eq(ncrRecords.companyId, companyId), ne(ncrRecords.status, 'CLOSED'), ne(ncrRecords.status, 'REJECTED'))),
    db.select({ value: sql<number>`COUNT(*)` }).from(safetyIncidents).where(and(eq(safetyIncidents.companyId, companyId), ne(safetyIncidents.status, 'CLOSED')))
  ]);

  return {
    totalRevenue: financials.totalRevenue,
    totalExpense: financials.totalExpense,
    netIncome: financials.netIncome,
    totalAssets: financials.totalAssets,
    openSalesOrdersCount: Number(openSalesOrders[0]?.value ?? 0),
    productionOrdersInProgressCount: Number(productionInProgress[0]?.value ?? 0),
    openNcrCount: Number(openNcr[0]?.value ?? 0),
    openSafetyIncidentsCount: Number(openSafety[0]?.value ?? 0),
    currentCash: forecast.currentCash,
    highAlertCount: alerts.filter((a) => a.severity === 'HIGH').length,
    mediumAlertCount: alerts.filter((a) => a.severity === 'MEDIUM').length,
    expiringSoonCount: expiring.length
  };
}

export interface FactoryManagerSummary {
  productionOrdersByStatus: { status: string; count: number }[];
  openMachineDowntimesCount: number;
  eamAssetsByStatus: { status: string; count: number }[];
  openNcrCount: number;
  expiringVehicleDocsCount: number;
  openSafetyIncidentsCount: number;
}

export async function getFactoryManagerSummary(companyId: string): Promise<FactoryManagerSummary> {
  const [prodRows, downtimeRows, eamRows, ncrRows, safetyRows, expiring] = await Promise.all([
    db.select({ status: productionOrders.status, count: sql<number>`COUNT(*)` }).from(productionOrders).where(eq(productionOrders.companyId, companyId)).groupBy(productionOrders.status),
    db.select({ value: sql<number>`COUNT(*)` }).from(machineDowntimes).where(and(eq(machineDowntimes.companyId, companyId), isNull(machineDowntimes.endedAt))),
    db.select({ status: eamAssets.status, count: sql<number>`COUNT(*)` }).from(eamAssets).where(eq(eamAssets.companyId, companyId)).groupBy(eamAssets.status),
    db.select({ value: sql<number>`COUNT(*)` }).from(ncrRecords).where(and(eq(ncrRecords.companyId, companyId), ne(ncrRecords.status, 'CLOSED'), ne(ncrRecords.status, 'REJECTED'))),
    db.select({ value: sql<number>`COUNT(*)` }).from(safetyIncidents).where(and(eq(safetyIncidents.companyId, companyId), ne(safetyIncidents.status, 'CLOSED'))),
    getExpirationAlerts(companyId, 30)
  ]);

  return {
    productionOrdersByStatus: prodRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    openMachineDowntimesCount: Number(downtimeRows[0]?.value ?? 0),
    eamAssetsByStatus: eamRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    openNcrCount: Number(ncrRows[0]?.value ?? 0),
    expiringVehicleDocsCount: expiring.filter((e) => e.module === 'FLEET').length,
    openSafetyIncidentsCount: Number(safetyRows[0]?.value ?? 0)
  };
}

export interface CfoSummary {
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  totalRevenue: string;
  totalExpense: string;
  netIncome: string;
  cashFlow30Day: { currentCash: number; expectedInflows: number; expectedOutflows: number; projectedEndingCash: number };
  fxExposure: FxExposureRow[];
  openSalesInvoicesCount: number;
  openVendorInvoicesCount: number;
  activeCollateralsCount: number;
}

export async function getCfoSummary(companyId: string): Promise<CfoSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [financials, forecast, fxExposure, salesInvRows, vendorInvRows, collateralRows] = await Promise.all([
    getFinancialStatements(companyId),
    getCashFlowForecast(companyId, today, thirtyDaysAhead),
    getFxExposure(companyId),
    db.select({ value: sql<number>`COUNT(*)` }).from(salesInvoices).where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.status, 'APPROVED'))),
    db.select({ value: sql<number>`COUNT(*)` }).from(procVinvoices).where(and(eq(procVinvoices.companyId, companyId), eq(procVinvoices.status, 'APPROVED'))),
    db.select({ value: sql<number>`COUNT(*)` }).from(legalCollaterals).where(and(eq(legalCollaterals.companyId, companyId), eq(legalCollaterals.status, 'ACTIVE')))
  ]);

  return {
    totalAssets: financials.totalAssets,
    totalLiabilitiesAndEquity: financials.totalLiabilitiesAndEquity,
    totalRevenue: financials.totalRevenue,
    totalExpense: financials.totalExpense,
    netIncome: financials.netIncome,
    cashFlow30Day: { currentCash: forecast.currentCash, expectedInflows: forecast.expectedInflows, expectedOutflows: forecast.expectedOutflows, projectedEndingCash: forecast.projectedEndingCash },
    fxExposure,
    openSalesInvoicesCount: Number(salesInvRows[0]?.value ?? 0),
    openVendorInvoicesCount: Number(vendorInvRows[0]?.value ?? 0),
    activeCollateralsCount: Number(collateralRows[0]?.value ?? 0)
  };
}
