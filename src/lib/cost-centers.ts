import 'server-only';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { costCenters, accountingJournalLines, accountingJournals } from '@/db/schema';
import { newId } from '@/lib/id';
import { money } from '@/lib/money';

// PDF madde 34 — Masraf Merkezi. Muhasebe fişi satırları zaten Faz 4'te
// costCenterId taşıyordu (JournalLineInput) — bu modül yalnızca (1) tanım
// tablosunu ve (2) o etiketlemenin gelir/gider raporunu ekliyor.

export interface CostCenterInput {
  code: string;
  name: string;
}

export async function createCostCenter(companyId: string, input: CostCenterInput): Promise<string> {
  const id = newId();
  await db.insert(costCenters).values({ id, companyId, code: input.code, name: input.name });
  return id;
}

export async function listCostCenters(companyId: string) {
  return db.select().from(costCenters).where(and(eq(costCenters.companyId, companyId), eq(costCenters.active, true)));
}

export interface CostCenterReportRow {
  costCenterId: string;
  costCenterCode: string;
  costCenterName: string;
  totalDebit: string;
  totalCredit: string;
  net: string;
}

// Masraf merkezi bazında gelir/gider analizi (PDF madde 34) — yalnızca
// costCenterId ETİKETLİ satırları toplar, etiketsiz satırlar bu raporda
// görünmez (kasıtlı: her fiş satırının masraf merkezi taşıması ZORUNLU
// DEĞİL, yalnızca isteğe bağlı bir boyut).
export async function getCostCenterReport(companyId: string): Promise<CostCenterReportRow[]> {
  const rows = await db
    .select({
      costCenterId: costCenters.id,
      costCenterCode: costCenters.code,
      costCenterName: costCenters.name,
      totalDebit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyDebit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${accountingJournalLines.baseCurrencyCredit}), 0)`
    })
    .from(costCenters)
    .leftJoin(accountingJournalLines, eq(accountingJournalLines.costCenterId, costCenters.id))
    .leftJoin(accountingJournals, and(eq(accountingJournals.id, accountingJournalLines.journalId), eq(accountingJournals.status, 'POSTED')))
    .where(eq(costCenters.companyId, companyId))
    .groupBy(costCenters.id, costCenters.code, costCenters.name);

  return rows.map((r) => {
    const debit = money(r.totalDebit);
    const credit = money(r.totalCredit);
    return { costCenterId: r.costCenterId, costCenterCode: r.costCenterCode, costCenterName: r.costCenterName, totalDebit: debit.toFixed(2), totalCredit: credit.toFixed(2), net: debit.minus(credit).toFixed(2) };
  });
}
