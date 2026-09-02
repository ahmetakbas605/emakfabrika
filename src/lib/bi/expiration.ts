import 'server-only';
import { listExpiringVehicleDocuments } from '@/lib/fleet/vehicles';
import { listExpiringContracts as listExpiringLegalContracts } from '@/lib/legal/contracts';
import { listExpiringEnvPermits } from '@/lib/environment/permits';
import { listExpiringQualifications } from '@/lib/hr/qualifications';
import { listLicenses, listWarranties, listContracts as listItContracts } from '@/lib/it/licensing';

// Holding ERP Faz 12 (BI) — "Expiration Engine". Madde 566'nın kendi notu:
// "kısmen İK Faz 1'de listExpiringQualifications olarak zaten var,
// genelleştirilecek" — bu dosya TAM OLARAK bunu yapıyor: 5 modülün ZATEN
// var olan 7 ayrı sona-erme sorgusunu (fleet/legal/environment/hr + IT'nin
// 3'ü) TEK bir normalize edilmiş listede birleştiriyor. Hiçbiri
// yeniden yazılmadı (§150) — IT'ninkiler HARİÇ, çünkü onlar sabit bir
// EXPIRING_SOON_DAYS=30 sabitine göre filtrelenmiş DÖNÜYOR (parametre
// almıyor); withinDays'in TÜM kaynaklarda TUTARLI çalışması için IT'nin
// TAM listelerini (listLicenses/listWarranties/listContracts — filtresiz)
// yeniden kullanıp withinDays filtresini BURADA, tek bir yerde uyguluyoruz.
export type ExpirationModule = 'FLEET' | 'LEGAL' | 'ENVIRONMENT' | 'HR' | 'IT';

export interface ExpirationAlert {
  module: ExpirationModule;
  itemType: string;
  id: string;
  label: string;
  expiryDate: string;
  daysRemaining: number;
}

function daysRemaining(expiryDate: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const expiry = new Date(expiryDate);
  return Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function withinWindow(expiryDate: string | null | undefined, withinDays: number): expiryDate is string {
  if (!expiryDate) return false;
  const d = daysRemaining(expiryDate);
  return d >= 0 && d <= withinDays;
}

export async function getExpirationAlerts(companyId: string, withinDays: number): Promise<ExpirationAlert[]> {
  const [vehicleDocs, legalContracts, envPermits, qualifications, licenses, warranties, itContracts] = await Promise.all([
    listExpiringVehicleDocuments(companyId, withinDays),
    listExpiringLegalContracts(companyId, withinDays),
    listExpiringEnvPermits(companyId, withinDays),
    listExpiringQualifications(companyId, withinDays),
    listLicenses(companyId),
    listWarranties(companyId),
    listItContracts(companyId)
  ]);

  const alerts: ExpirationAlert[] = [];

  for (const v of vehicleDocs) {
    alerts.push({ module: 'FLEET', itemType: v.documentType, id: v.vehicleId, label: `${v.plateNo} — ${v.detail}`, expiryDate: v.expiryDate, daysRemaining: daysRemaining(v.expiryDate) });
  }
  for (const c of legalContracts) {
    if (!c.endDate) continue;
    alerts.push({ module: 'LEGAL', itemType: 'CONTRACT', id: c.id, label: `${c.contractNo} — ${c.title}`, expiryDate: c.endDate, daysRemaining: daysRemaining(c.endDate) });
  }
  for (const p of envPermits) {
    if (!p.expiryDate) continue;
    alerts.push({ module: 'ENVIRONMENT', itemType: p.permitType, id: p.id, label: `${p.permitNo} (${p.permitType})`, expiryDate: p.expiryDate, daysRemaining: daysRemaining(p.expiryDate) });
  }
  for (const q of qualifications) {
    if (!q.expiryDate) continue;
    alerts.push({ module: 'HR', itemType: q.qualificationType, id: q.id, label: `${q.employeeFirstName} ${q.employeeLastName} — ${q.name}`, expiryDate: q.expiryDate, daysRemaining: daysRemaining(q.expiryDate) });
  }
  for (const l of licenses) {
    if (withinWindow(l.expiresAt, withinDays)) alerts.push({ module: 'IT', itemType: 'LICENSE', id: l.id, label: `${l.productName} lisansı`, expiryDate: l.expiresAt, daysRemaining: daysRemaining(l.expiresAt) });
  }
  for (const w of warranties) {
    if (withinWindow(w.endDate, withinDays)) alerts.push({ module: 'IT', itemType: 'WARRANTY', id: w.id, label: `${w.assetTag} garantisi`, expiryDate: w.endDate, daysRemaining: daysRemaining(w.endDate) });
  }
  for (const c of itContracts) {
    if (withinWindow(c.endDate, withinDays)) alerts.push({ module: 'IT', itemType: 'CONTRACT', id: c.id, label: `${c.title} (BT sözleşmesi)`, expiryDate: c.endDate, daysRemaining: daysRemaining(c.endDate) });
  }

  return alerts.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}
