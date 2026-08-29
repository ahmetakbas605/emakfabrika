import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { procScoringWeights, procTechEvals, procCommEvals, procQuotationLines, procQuotations, procRfqs } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { getRfqComparison } from './rfq';
import { ProcurementError } from './errors';

// Satınalma Faz 3 — Teknik/Ticari Değerlendirme + Ağırlıklı Skorlama
// (madde 69-74). Faz 2'nin karşılaştırma verisini (fiyat) TÜKETİR.

export interface ScoringWeights {
  priceWeight: string;
  technicalWeight: string;
  deliveryWeight: string;
  commercialWeight: string;
}

const DEFAULT_WEIGHTS: ScoringWeights = { priceWeight: '50', technicalWeight: '20', deliveryWeight: '10', commercialWeight: '20' };

export async function getScoringWeights(companyId: string): Promise<ScoringWeights> {
  const [row] = await db.select().from(procScoringWeights).where(eq(procScoringWeights.companyId, companyId)).limit(1);
  if (!row) return DEFAULT_WEIGHTS;
  return { priceWeight: row.priceWeight, technicalWeight: row.technicalWeight, deliveryWeight: row.deliveryWeight, commercialWeight: row.commercialWeight };
}

export async function setScoringWeights(companyId: string, input: { priceWeight: number | string; technicalWeight: number | string; deliveryWeight: number | string; commercialWeight: number | string }): Promise<void> {
  const total = money(input.priceWeight).plus(money(input.technicalWeight)).plus(money(input.deliveryWeight)).plus(money(input.commercialWeight));
  if (!total.equals(100)) throw new ProcurementError(`Ağırlıklar toplamda %100 olmalı — şu an %${total.toFixed(2)}.`);

  const values = {
    companyId,
    priceWeight: toDb(input.priceWeight),
    technicalWeight: toDb(input.technicalWeight),
    deliveryWeight: toDb(input.deliveryWeight),
    commercialWeight: toDb(input.commercialWeight)
  };
  await db.insert(procScoringWeights).values(values).onDuplicateKeyUpdate({ set: values });
}

// --- Teknik Değerlendirme (madde 71-73) ---

export interface SubmitTechnicalEvaluationInput {
  complianceStatus: (typeof procTechEvals.$inferInsert)['complianceStatus'];
  reason?: string;
}

async function requireQuotationLineInCompany(companyId: string, quotationLineId: string): Promise<void> {
  const [row] = await db
    .select({ rfqCompanyId: procRfqs.companyId })
    .from(procQuotationLines)
    .innerJoin(procQuotations, eq(procQuotations.id, procQuotationLines.quotationId))
    .innerJoin(procRfqs, eq(procRfqs.id, procQuotations.rfqId))
    .where(eq(procQuotationLines.id, quotationLineId))
    .limit(1);
  if (!row || row.rfqCompanyId !== companyId) throw new ProcurementError('Teklif satırı bulunamadı.');
}

export async function submitTechnicalEvaluation(companyId: string, quotationLineId: string, evaluatedByUserId: string, input: SubmitTechnicalEvaluationInput): Promise<void> {
  await requireQuotationLineInCompany(companyId, quotationLineId);
  if ((input.complianceStatus === 'NON_COMPLIANT' || input.complianceStatus === 'REJECTED') && !input.reason?.trim()) {
    throw new ProcurementError('Uygun olmayan/reddedilen bir değerlendirme için gerekçe zorunlu.');
  }

  const values = { id: newId(), quotationLineId, complianceStatus: input.complianceStatus, reason: input.reason, evaluatedByUserId, evaluatedAt: new Date() };
  await db.insert(procTechEvals).values(values).onDuplicateKeyUpdate({ set: { complianceStatus: input.complianceStatus, reason: input.reason, evaluatedByUserId, evaluatedAt: new Date() } });
}

// --- Ticari Değerlendirme (madde 74) ---

export interface SubmitCommercialEvaluationInput {
  score: number | string;
  notes?: string;
}

async function requireQuotationInCompany(companyId: string, quotationId: string): Promise<void> {
  const [row] = await db.select({ rfqCompanyId: procRfqs.companyId }).from(procQuotations).innerJoin(procRfqs, eq(procRfqs.id, procQuotations.rfqId)).where(eq(procQuotations.id, quotationId)).limit(1);
  if (!row || row.rfqCompanyId !== companyId) throw new ProcurementError('Teklif bulunamadı.');
}

export async function submitCommercialEvaluation(companyId: string, quotationId: string, evaluatedByUserId: string, input: SubmitCommercialEvaluationInput): Promise<void> {
  await requireQuotationInCompany(companyId, quotationId);
  const score = money(input.score);
  if (score.lessThan(0) || score.greaterThan(100)) throw new ProcurementError('Puan 0-100 aralığında olmalı.');

  const values = { id: newId(), quotationId, score: toDb(score), notes: input.notes, evaluatedByUserId, evaluatedAt: new Date() };
  await db.insert(procCommEvals).values(values).onDuplicateKeyUpdate({ set: { score: toDb(score), notes: input.notes, evaluatedByUserId, evaluatedAt: new Date() } });
}

// --- Ağırlıklı skorlama (madde 69-70) ---

export interface EvaluationCell {
  supplierPartyId: string;
  supplierName: string;
  quotationLineId: string | null;
  quotationId: string | null;
  priceScore: number | null;
  technicalScore: number | null;
  technicalStatus: string | null;
  technicalReason: string | null;
  deliveryScore: number | null;
  commercialScore: number | null;
  commercialNotes: string | null;
  weightedTotal: number | null;
}

export interface EvaluationRow {
  rfqLineId: string;
  description: string;
  cells: EvaluationCell[];
}

const COMPLIANCE_SCORE: Record<string, number> = { COMPLIANT: 100, ALTERNATIVE_ACCEPTED: 80, PARTIALLY_COMPLIANT: 50, NON_COMPLIANT: 0, REJECTED: 0 };

export async function getRfqEvaluation(companyId: string, rfqId: string): Promise<{ rows: EvaluationRow[]; weights: ScoringWeights }> {
  const [comparison, weights] = await Promise.all([getRfqComparison(companyId, rfqId), getScoringWeights(companyId)]);

  // Karşılaştırmadaki her satırın teklif satırı kimliğini (quotationLineId)
  // bulmak için ayrı bir sorgu — getRfqComparison bunu döndürmüyor (Faz 2
  // yalnızca gösterim için tasarlanmıştı), burada evaluation formlarının
  // doğru satıra bağlanabilmesi için gerekli.
  const quotationLines = await db
    .select({ id: procQuotationLines.id, rfqLineId: procQuotationLines.rfqLineId, quotationId: procQuotationLines.quotationId, supplierPartyId: procQuotations.supplierPartyId, version: procQuotations.version, deliveryDaysLine: procQuotationLines.deliveryDays, deliveryDaysHeader: procQuotations.deliveryDays })
    .from(procQuotationLines)
    .innerJoin(procQuotations, eq(procQuotations.id, procQuotationLines.quotationId))
    .innerJoin(procRfqs, eq(procRfqs.id, procQuotations.rfqId))
    .where(eq(procRfqs.id, rfqId));

  // Yalnızca EN SON versiyon (Faz 2 ile AYNI ilke).
  const latestVersionBySupplier = new Map<string, number>();
  for (const ql of quotationLines) {
    const current = latestVersionBySupplier.get(ql.supplierPartyId);
    if (current === undefined || ql.version > current) latestVersionBySupplier.set(ql.supplierPartyId, ql.version);
  }
  const latestQuotationLines = quotationLines.filter((ql) => latestVersionBySupplier.get(ql.supplierPartyId) === ql.version);

  const allTechEvals = await db.select().from(procTechEvals);
  const techEvalByLineId = new Map(allTechEvals.map((e) => [e.quotationLineId, e]));

  const allCommEvals = await db.select().from(procCommEvals);
  const commEvalByQuotationId = new Map(allCommEvals.map((e) => [e.quotationId, e]));

  const W = { price: money(weights.priceWeight), technical: money(weights.technicalWeight), delivery: money(weights.deliveryWeight), commercial: money(weights.commercialWeight) };

  return {
    weights,
    rows: comparison.map((compRow) => {
      // Bu RFQ satırı için tüm tedarikçilerin teslim süresi — en hızlı
      // referans (delivery skoru için).
      const lineQuotationLines = latestQuotationLines.filter((ql) => ql.rfqLineId === compRow.rfqLineId);
      const deliveryDaysBySupplier = new Map<string, number | null>();
      for (const ql of lineQuotationLines) {
        const days = ql.deliveryDaysLine ?? ql.deliveryDaysHeader ?? null;
        deliveryDaysBySupplier.set(ql.supplierPartyId, days);
      }
      const knownDeliveryDays = [...deliveryDaysBySupplier.values()].filter((d): d is number => d !== null);
      const fastestDays = knownDeliveryDays.length > 0 ? Math.min(...knownDeliveryDays) : null;

      const cells: EvaluationCell[] = compRow.cells.map((cell) => {
        const ql = lineQuotationLines.find((q) => q.supplierPartyId === cell.supplierPartyId);
        const priceScore = Number(cell.netUnitPrice) > 0 ? Number(compRow.cells.reduce((min, c) => Math.min(min, Number(c.netUnitPrice)), Infinity)) / Number(cell.netUnitPrice) * 100 : null;

        const techEval = ql ? techEvalByLineId.get(ql.id) : undefined;
        const technicalScore = techEval ? COMPLIANCE_SCORE[techEval.complianceStatus] : null;

        const days = ql ? (deliveryDaysBySupplier.get(ql.supplierPartyId) ?? null) : null;
        const deliveryScore = days !== null && fastestDays !== null ? (fastestDays / days) * 100 : null;

        const commEval = ql ? commEvalByQuotationId.get(ql.quotationId) : undefined;
        const commercialScore = commEval ? Number(commEval.score) : null;

        // Yalnızca DEĞERİ olan bileşenler ağırlıklı ortalamaya girer —
        // ağırlıklar bu MEVCUT bileşenler arasında YENİDEN normalize
        // edilir (eksik veri sıfır gibi CEZALANDIRILMAZ, hesap DIŞI
        // tutulur — madde 141'in "AI/skorlama nihai karar verici değil,
        // öneri verir" ilkesiyle tutarlı: eksik veriyle yanlış bir kesinlik
        // izlenimi vermemek).
        const components: { score: number; weight: ReturnType<typeof money> }[] = [];
        if (priceScore !== null) components.push({ score: priceScore, weight: W.price });
        if (technicalScore !== null) components.push({ score: technicalScore, weight: W.technical });
        if (deliveryScore !== null) components.push({ score: deliveryScore, weight: W.delivery });
        if (commercialScore !== null) components.push({ score: commercialScore, weight: W.commercial });
        const totalWeight = components.reduce((acc, c) => acc.plus(c.weight), money(0));
        const weightedTotal = totalWeight.greaterThan(0)
          ? components.reduce((acc, c) => acc.plus(money(c.score).times(c.weight)), money(0)).dividedBy(totalWeight).toDecimalPlaces(1).toNumber()
          : null;

        return {
          supplierPartyId: cell.supplierPartyId, supplierName: cell.supplierName, quotationLineId: ql?.id ?? null, quotationId: ql?.quotationId ?? null,
          priceScore: priceScore !== null ? Math.round(priceScore * 10) / 10 : null,
          technicalScore, technicalStatus: techEval?.complianceStatus ?? null, technicalReason: techEval?.reason ?? null,
          deliveryScore: deliveryScore !== null ? Math.round(deliveryScore * 10) / 10 : null,
          commercialScore, commercialNotes: commEval?.notes ?? null,
          weightedTotal
        };
      });

      cells.sort((a, b) => (b.weightedTotal ?? -1) - (a.weightedTotal ?? -1));
      return { rfqLineId: compRow.rfqLineId, description: compRow.description, cells };
    })
  };
}
