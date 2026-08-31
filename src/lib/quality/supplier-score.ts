import 'server-only';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { qualityInspections, procReceiptLines, procReceipts, procPos, ncrRecords, parties } from '@/db/schema';
import { QualityError } from './errors';

// Holding ERP Faz 5 (Kalite) — Tedarikçi Kalite. lib/mes/oee.ts İLE AYNI
// felsefe: SAKLANAN bir "skor" tablosu DEĞİL, quality_inspections (Giriş
// tipi, sourceType='PROC_RECEIPT_LINE' → proc_receipt_lines → proc_receipts
// → proc_pos.supplierPartyId zinciriyle bu tedarikçiye ait olanlar) +
// ncr_records (supplierPartyId doğrudan) üzerinden TALEP ÜZERİNE
// hesaplanan bir rapor.

export interface SupplierQualityScore {
  supplierPartyId: string;
  supplierName: string;
  fromDate: string;
  toDate: string;
  incomingInspectionCount: number;
  incomingPassCount: number;
  incomingPassRate: number | null;
  ncrCount: number;
  ncrBySeverity: { MINOR: number; MAJOR: number; CRITICAL: number };
  openNcrCount: number;
}

export async function getSupplierQualityScore(companyId: string, supplierPartyId: string, fromDate: string, toDate: string): Promise<SupplierQualityScore> {
  const [supplier] = await db.select({ id: parties.id, legalName: parties.legalName }).from(parties).where(and(eq(parties.id, supplierPartyId), eq(parties.companyId, companyId))).limit(1);
  if (!supplier) throw new QualityError('Tedarikçi (cari) bulunamadı.');

  const toDateEnd = new Date(`${toDate}T23:59:59`);
  const fromDateStart = new Date(`${fromDate}T00:00:00`);

  const incomingInspections = await db
    .select({ result: qualityInspections.result })
    .from(qualityInspections)
    .innerJoin(procReceiptLines, eq(procReceiptLines.id, qualityInspections.sourceId))
    .innerJoin(procReceipts, eq(procReceipts.id, procReceiptLines.receiptId))
    .innerJoin(procPos, eq(procPos.id, procReceipts.poId))
    .where(and(
      eq(qualityInspections.companyId, companyId), eq(qualityInspections.type, 'INCOMING'), eq(qualityInspections.sourceType, 'PROC_RECEIPT_LINE'),
      eq(procPos.supplierPartyId, supplierPartyId), gte(qualityInspections.inspectedAt, fromDateStart), lte(qualityInspections.inspectedAt, toDateEnd)
    ));

  const incomingInspectionCount = incomingInspections.length;
  const incomingPassCount = incomingInspections.filter((i) => i.result === 'PASS').length;
  const incomingPassRate = incomingInspectionCount > 0 ? incomingPassCount / incomingInspectionCount : null;

  const ncrs = await db
    .select({ severity: ncrRecords.severity, status: ncrRecords.status })
    .from(ncrRecords)
    .where(and(eq(ncrRecords.companyId, companyId), eq(ncrRecords.supplierPartyId, supplierPartyId), gte(ncrRecords.createdAt, fromDateStart), lte(ncrRecords.createdAt, toDateEnd)));

  const ncrBySeverity = { MINOR: 0, MAJOR: 0, CRITICAL: 0 };
  let openNcrCount = 0;
  for (const n of ncrs) {
    ncrBySeverity[n.severity]++;
    if (n.status !== 'CLOSED' && n.status !== 'REJECTED') openNcrCount++;
  }

  return {
    supplierPartyId, supplierName: supplier.legalName, fromDate, toDate,
    incomingInspectionCount, incomingPassCount, incomingPassRate,
    ncrCount: ncrs.length, ncrBySeverity, openNcrCount
  };
}
