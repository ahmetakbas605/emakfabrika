import 'server-only';
import { writeAuditLog, type AuditRiskLevel } from './audit';
import { checkMassExportThreshold } from './events';

// Core Security (rapor §09, madde 20-21) — export'u AYRI bir export_logs
// tablosu yerine audit_logs'un action='EXPORT' türü olarak modelliyor
// (bkz. writeAuditLog) — export'un kendisi zaten bir audit olayı, ikinci
// bir tabloya bölmek gereksiz tekrar olurdu. Bu dosya yalnızca export'a
// ÖZGÜ iki şeyi ekliyor: risk skorlaması (veri türüne göre) ve toplu-
// export eşiği kontrolü.

const MASS_EXPORT_THRESHOLD = 500;

export interface RecordExportInput {
  companyId: string;
  userId: string;
  dataType: string;
  entity: string;
  rowCount: number;
  filterDescription?: string;
  format?: string;
  ip?: string;
}

// madde 21 — satır sayısına göre risk: küçük export normal (HIGH taban
// zaten export=riskli kabul ediliyor, madde 20), 500+ satır CRITICAL VE
// ayrıca bir security_event üretir (madde 27 mass-export senaryosu).
export async function recordExport(input: RecordExportInput): Promise<void> {
  const riskLevel: AuditRiskLevel = input.rowCount > MASS_EXPORT_THRESHOLD ? 'CRITICAL' : 'HIGH';
  await writeAuditLog({
    companyId: input.companyId, userId: input.userId, action: 'EXPORT', entity: input.entity, module: 'SECURITY',
    riskLevel, ip: input.ip, changedFields: { dataType: input.dataType, rowCount: input.rowCount, filter: input.filterDescription ?? '', format: input.format ?? '' }
  });
  await checkMassExportThreshold(input.companyId, input.userId, input.rowCount, MASS_EXPORT_THRESHOLD);
}

export { MASS_EXPORT_THRESHOLD };
