import 'server-only';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { procRequests, procRequestLines, procRfqs, procRfqLines, procAwards, procPos, procPoLines, procReceiptLines, procVinvoices, procVinvoiceLines, parties } from '@/db/schema';
import { money } from '@/lib/money';
import { listPendingApprovalsForUser } from '@/lib/workflow/engine';

// Satınalma Faz 7 — Dashboard. EMAK-FABRIKA'nın KENDİ erişim modeliyle
// (departman seçimi + requireDepartmentAccess, lib/dal.ts) TUTARLI olacak
// şekilde tasarlandı — emakerp/emakbilisim'in tenant_id+RLS modeliyle
// KARIŞTIRILMADI, bu tek-şirket/departman-bazlı bir modelleme. Talep
// bazlı veriler (Bölüm B) departman'a göre SÜZÜLÜR (procRequests.
// departmentId zaten bunun için var); RFQ/Award/PO/Fatura seviyesi
// veriler (Bölüm C) departman'a göre ANLAMLI SÜZÜLEMEZ — madde 49-50'nin
// "bir RFQ birden fazla departmanın talep satırını birleştirebilir"
// tasarımı gereği tek bir RFQ/Award/PO birden fazla departmana ait
// olabilir — bu yüzden Bölüm C yalnızca fabrika yöneticisine gösterilir
// (requireFactoryAdmin İLE AYNI "şirket geneli veri = admin" ilkesi).

export interface RequisitionStatusBreakdown {
  status: string;
  count: number;
}

// scope: 'ALL' fabrika yöneticisi için (tüm departmanlar); aksi halde
// kullanıcının ERİŞTİĞİ departmanlar + KENDİ oluşturduğu talepler (departman
// ataması olmasa bile kendi talebini görebilmeli — "her kullanıcı kendi
// ekranını görür" ilkesi).
export async function getRequisitionStatusBreakdown(companyId: string, scope: { departmentIds: string[] } | 'ALL', userId: string): Promise<RequisitionStatusBreakdown[]> {
  let visibility;
  if (scope === 'ALL') {
    visibility = eq(procRequests.companyId, companyId);
  } else if (scope.departmentIds.length > 0) {
    visibility = and(eq(procRequests.companyId, companyId), or(inArray(procRequests.departmentId, scope.departmentIds), eq(procRequests.requestedByUserId, userId)));
  } else {
    visibility = and(eq(procRequests.companyId, companyId), eq(procRequests.requestedByUserId, userId));
  }

  const rows = await db.select({ status: procRequests.status }).from(procRequests).where(visibility);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

export async function getMyPendingProcurementApprovalsCount(companyId: string, userId: string): Promise<number> {
  const rows = await listPendingApprovalsForUser(companyId, userId);
  return rows.filter((r) => r.documentType === 'PROCUREMENT_REQUISITION' || r.documentType === 'PROCUREMENT_AWARD').length;
}

export interface ProcurementPipelineStats {
  queueLineCount: number;
  openRfqCount: number;
  awardsPendingApprovalCount: number;
  posAwaitingReceiptCount: number;
  draftInvoiceCount: number;
}

// Şirket geneli — YALNIZCA fabrika yöneticisine gösterilir (yukarıdaki dosya
// yorumu).
export async function getProcurementPipelineStats(companyId: string): Promise<ProcurementPipelineStats> {
  const [queueRows, openRfqRows, awardRows, poRows, poLineRows, receiptLineRows, draftInvoiceRows] = await Promise.all([
    db.select({ id: procRequestLines.id }).from(procRequestLines).innerJoin(procRequests, eq(procRequests.id, procRequestLines.requestId)).leftJoin(procRfqLines, eq(procRfqLines.srcRequestLineId, procRequestLines.id)).where(and(eq(procRequests.companyId, companyId), eq(procRequests.status, 'APPROVED'), isNull(procRfqLines.id))),
    db.select({ id: procRfqs.id }).from(procRfqs).where(and(eq(procRfqs.companyId, companyId), eq(procRfqs.status, 'SENT'))),
    db.select({ id: procAwards.id }).from(procAwards).where(and(eq(procAwards.companyId, companyId), eq(procAwards.status, 'SUBMITTED'))),
    db.select({ id: procPos.id }).from(procPos).where(and(eq(procPos.companyId, companyId), inArray(procPos.status, ['ISSUED', 'ACKNOWLEDGED']))),
    db.select({ id: procPoLines.id, poId: procPoLines.poId, quantity: procPoLines.quantity }).from(procPoLines).innerJoin(procPos, eq(procPos.id, procPoLines.poId)).where(and(eq(procPos.companyId, companyId), inArray(procPos.status, ['ISSUED', 'ACKNOWLEDGED']))),
    db.select({ poLineId: procReceiptLines.poLineId, receivedQty: procReceiptLines.receivedQty }).from(procReceiptLines).innerJoin(procPoLines, eq(procPoLines.id, procReceiptLines.poLineId)).innerJoin(procPos, eq(procPos.id, procPoLines.poId)).where(and(eq(procPos.companyId, companyId), inArray(procPos.status, ['ISSUED', 'ACKNOWLEDGED']))),
    db.select({ id: procVinvoices.id }).from(procVinvoices).where(and(eq(procVinvoices.companyId, companyId), eq(procVinvoices.status, 'DRAFT')))
  ]);

  // getPoReceivingStatus'un (receiving.ts) AYNI "canlı SUM" mantığı — burada
  // TÜM PO'lar için tek seferde, N+1 sorgu yerine.
  const receivedByPoLine = new Map<string, ReturnType<typeof money>>();
  for (const r of receiptLineRows) receivedByPoLine.set(r.poLineId, (receivedByPoLine.get(r.poLineId) ?? money(0)).plus(money(r.receivedQty)));
  const posWithRemaining = new Set<string>();
  for (const line of poLineRows) {
    const received = receivedByPoLine.get(line.id) ?? money(0);
    if (received.lessThan(money(line.quantity))) posWithRemaining.add(line.poId);
  }

  return {
    queueLineCount: queueRows.length,
    openRfqCount: openRfqRows.length,
    awardsPendingApprovalCount: awardRows.length,
    posAwaitingReceiptCount: posWithRemaining.size,
    draftInvoiceCount: draftInvoiceRows.length
  };
}

export interface SupplierSpend {
  supplierPartyId: string;
  supplierName: string;
  totalSpend: string;
}

// Yalnızca ONAYLANMIŞ (APPROVED) faturalar — taslak/iptal edilmiş bir
// fatura henüz GERÇEK bir harcama taahhüdü değil.
export async function getTopSupplierSpend(companyId: string, limit = 5): Promise<SupplierSpend[]> {
  const rows = await db
    .select({ supplierPartyId: procPos.supplierPartyId, supplierName: parties.legalName, lineTotal: procVinvoiceLines.lineTotal })
    .from(procVinvoiceLines)
    .innerJoin(procVinvoices, eq(procVinvoices.id, procVinvoiceLines.invoiceId))
    .innerJoin(procPos, eq(procPos.id, procVinvoices.poId))
    .innerJoin(parties, eq(parties.id, procPos.supplierPartyId))
    .where(and(eq(procVinvoices.companyId, companyId), eq(procVinvoices.status, 'APPROVED')));

  const bySupplier = new Map<string, { supplierName: string; total: ReturnType<typeof money> }>();
  for (const r of rows) {
    const current = bySupplier.get(r.supplierPartyId) ?? { supplierName: r.supplierName, total: money(0) };
    current.total = current.total.plus(money(r.lineTotal));
    bySupplier.set(r.supplierPartyId, current);
  }

  return [...bySupplier.entries()]
    .map(([supplierPartyId, v]) => ({ supplierPartyId, supplierName: v.supplierName, totalSpend: v.total.toFixed(2) }))
    .sort((a, b) => Number(b.totalSpend) - Number(a.totalSpend))
    .slice(0, limit);
}
