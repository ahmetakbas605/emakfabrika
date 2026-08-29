import 'server-only';
import { eq, and, sql, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { serviceDeskTickets, incidents, monitoringAlerts, monitorTargets, itAssets, endpointCompliance } from '@/db/schema';
import { listExpiringLicenses, listExpiringWarranties, listExpiringContracts } from '@/lib/it/licensing';

// Faz 16 (Reports/Dashboard) — IT-ARCHITECTURE.md'nin Faz listesinde
// yalnızca başlığı var (Faz 14/15 ile AYNI dürüst boşluk). Ayrı bir "rapor
// tablosu" YOK — tüm bu sayılar zaten var olan tablolardan CANLI hesaplanır
// (madde 87'nin "ham tabloyu gereksiz tekrar tarama" ilkesiyle çelişmiyor,
// çünkü bunlar zaten COUNT/GROUP BY gibi ucuz toplama sorguları, Muhasebe'nin
// mizanındaki gibi önceden hesaplanmış bir özet tablo GEREKTİRMİYOR).
export interface ItDashboardSummary {
  openTicketsByStatus: { status: string; count: number }[];
  openIncidentsCount: number;
  openAlertsCount: number;
  assetsByStatus: { status: string; count: number }[];
  expiringLicensesCount: number;
  expiringWarrantiesCount: number;
  expiringContractsCount: number;
  nonCompliantAssetsCount: number;
}

const TICKET_CLOSED_STATUSES = ['CLOSED'] as const;

// Bir varlığın BİRDEN FAZLA uyumluluk kaydı olabilir (periyodik kontrol) —
// "uyumsuz varlık sayısı" için her varlığın YALNIZCA en son kaydı sayılır
// (MAX(checked_at) alt sorgusu), eski bir NON_COMPLIANT kaydı sonradan
// düzeltilmiş bir varlığı yanlış sayıya dahil etmesin diye.
async function countNonCompliantAssets(companyId: string): Promise<number> {
  const latestPerAsset = db
    .select({ assetId: endpointCompliance.assetId, maxCheckedAt: sql<Date>`MAX(${endpointCompliance.checkedAt})`.as('max_checked_at') })
    .from(endpointCompliance)
    .innerJoin(itAssets, eq(itAssets.id, endpointCompliance.assetId))
    .where(eq(itAssets.companyId, companyId))
    .groupBy(endpointCompliance.assetId)
    .as('latest');

  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(endpointCompliance)
    .innerJoin(latestPerAsset, and(eq(latestPerAsset.assetId, endpointCompliance.assetId), eq(latestPerAsset.maxCheckedAt, endpointCompliance.checkedAt)))
    .where(eq(endpointCompliance.overall, 'NON_COMPLIANT'));
  return Number(rows[0]?.count ?? 0);
}

export async function getItDashboardSummary(companyId: string): Promise<ItDashboardSummary> {
  const [ticketRows, incidentRows, alertRows, assetRows, expiringLicenses, expiringWarranties, expiringContracts, nonCompliantAssetsCount] = await Promise.all([
    db.select({ status: serviceDeskTickets.status, count: sql<number>`COUNT(*)` }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.companyId, companyId), notInArray(serviceDeskTickets.status, [...TICKET_CLOSED_STATUSES]))).groupBy(serviceDeskTickets.status),
    db.select({ count: sql<number>`COUNT(*)` }).from(incidents).where(and(eq(incidents.companyId, companyId), notInArray(incidents.status, ['CLOSED']))),
    db.select({ count: sql<number>`COUNT(*)` }).from(monitoringAlerts).innerJoin(monitorTargets, eq(monitorTargets.id, monitoringAlerts.targetId)).where(and(eq(monitorTargets.companyId, companyId), eq(monitoringAlerts.status, 'OPEN'))),
    db.select({ status: itAssets.status, count: sql<number>`COUNT(*)` }).from(itAssets).where(eq(itAssets.companyId, companyId)).groupBy(itAssets.status),
    listExpiringLicenses(companyId),
    listExpiringWarranties(companyId),
    listExpiringContracts(companyId),
    countNonCompliantAssets(companyId)
  ]);

  return {
    openTicketsByStatus: ticketRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    openIncidentsCount: Number(incidentRows[0]?.count ?? 0),
    openAlertsCount: Number(alertRows[0]?.count ?? 0),
    assetsByStatus: assetRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    expiringLicensesCount: expiringLicenses.length,
    expiringWarrantiesCount: expiringWarranties.length,
    expiringContractsCount: expiringContracts.length,
    nonCompliantAssetsCount
  };
}
