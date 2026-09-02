import 'server-only';
import { eq, and, ne, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { safetyIncidents, ncrRecords, customerComplaints, legalLawsuits, riskRegisterEntries } from '@/db/schema';
import { getExpirationAlerts } from './expiration';

// Holding ERP Faz 12 (BI) — "Alert Center". Madde 565'in istediği tek bir
// dikkat-gerektiren-öğeler listesi; YENİ bir "alert" tablosu AÇILMADI
// (§150/"saklanan alan değil talep üzerine hesaplanan rapor" — bu oturumun
// OEE'den beri tekrar tekrar uyguladığı desen), her modülün ZATEN var olan
// açık/kritik kayıtları BURADA salt-okunur olarak toplanır. Kapsam BİLİNÇLİ
// OLARAK sınırlı: gerçek bir kural motoru/eşik konfigürasyonu (madde
// metninin işaret ettiği ileri düzey senaryo) DEĞİL, mevcut severity/
// priority/status alanlarının SABİT bir okuma yorumu — TODO:
// CONFIGURABLE_ALERT_THRESHOLDS, gelecekte kullanıcı bazlı eşik
// tanımlanabilirse burası genişletilir.
export type AlertSeverity = 'HIGH' | 'MEDIUM';

export interface AlertCenterItem {
  module: string;
  itemType: string;
  id: string;
  label: string;
  severity: AlertSeverity;
}

const RISK_HIGH_SCORE_THRESHOLD = 15; // probability(1-5)×impact(1-5) — 5×3/3×5 ve üzeri "yüksek".
const EXPIRATION_IMMINENT_DAYS = 7;

export async function getAlertCenterItems(companyId: string): Promise<AlertCenterItem[]> {
  const [incidents, ncrs, complaints, lawsuits, risks, imminentExpirations] = await Promise.all([
    db.select({ id: safetyIncidents.id, incidentNo: safetyIncidents.incidentNo, severity: safetyIncidents.severity }).from(safetyIncidents).where(and(eq(safetyIncidents.companyId, companyId), ne(safetyIncidents.status, 'CLOSED'))),
    db.select({ id: ncrRecords.id, ncrNo: ncrRecords.ncrNo, severity: ncrRecords.severity }).from(ncrRecords).where(and(eq(ncrRecords.companyId, companyId), ne(ncrRecords.status, 'CLOSED'), ne(ncrRecords.status, 'REJECTED'))),
    db.select({ id: customerComplaints.id, complaintNo: customerComplaints.complaintNo, priority: customerComplaints.priority }).from(customerComplaints).where(and(eq(customerComplaints.companyId, companyId), ne(customerComplaints.status, 'CLOSED'))),
    db.select({ id: legalLawsuits.id, caseNo: legalLawsuits.caseNo, title: legalLawsuits.title }).from(legalLawsuits).where(and(eq(legalLawsuits.companyId, companyId), ne(legalLawsuits.status, 'CLOSED'), ne(legalLawsuits.status, 'SETTLED'), ne(legalLawsuits.status, 'WON'), ne(legalLawsuits.status, 'LOST'))),
    db.select({ id: riskRegisterEntries.id, riskNo: riskRegisterEntries.riskNo, title: riskRegisterEntries.title, score: riskRegisterEntries.score }).from(riskRegisterEntries).where(and(eq(riskRegisterEntries.companyId, companyId), ne(riskRegisterEntries.status, 'CLOSED'), gte(riskRegisterEntries.score, RISK_HIGH_SCORE_THRESHOLD))),
    getExpirationAlerts(companyId, EXPIRATION_IMMINENT_DAYS)
  ]);

  const items: AlertCenterItem[] = [];
  for (const i of incidents) items.push({ module: 'SAFETY', itemType: 'INCIDENT', id: i.id, label: `${i.incidentNo} — açık kaza/olay`, severity: i.severity === 'SEVERE' || i.severity === 'FATAL' ? 'HIGH' : 'MEDIUM' });
  for (const n of ncrs) items.push({ module: 'QUALITY', itemType: 'NCR', id: n.id, label: `${n.ncrNo} — açık uygunsuzluk`, severity: n.severity === 'CRITICAL' || n.severity === 'MAJOR' ? 'HIGH' : 'MEDIUM' });
  for (const c of complaints) items.push({ module: 'SALES', itemType: 'COMPLAINT', id: c.id, label: `${c.complaintNo} — açık şikayet`, severity: c.priority === 'HIGH' || c.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM' });
  for (const l of lawsuits) items.push({ module: 'LEGAL', itemType: 'LAWSUIT', id: l.id, label: `${l.caseNo} — ${l.title}`, severity: 'MEDIUM' });
  for (const r of risks) items.push({ module: 'LEGAL', itemType: 'RISK', id: r.id, label: `${r.riskNo} — ${r.title} (skor ${r.score})`, severity: 'HIGH' });
  for (const e of imminentExpirations) items.push({ module: e.module, itemType: `EXPIRING_${e.itemType}`, id: e.id, label: `${e.label} — ${e.daysRemaining} gün içinde sona eriyor`, severity: 'HIGH' });

  return items;
}
