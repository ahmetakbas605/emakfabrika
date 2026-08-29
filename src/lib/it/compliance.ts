import 'server-only';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { endpointCompliance, itAssets } from '@/db/schema';
import { newId } from '@/lib/id';

// IT-SECURITY.md §4 — "overall" uygulama katmanında HESAPLANIR, DB trigger
// DEĞİL. Tüm alt-durumlar COMPLIANT ise COMPLIANT, herhangi biri UNKNOWN
// ise (henüz kontrol edilmemiş) UNKNOWN, aksi halde NON_COMPLIANT.
export function computeOverallStatus(statuses: { antivirusStatus: string; firewallStatus: string; encryptionStatus: string; patchStatus: string; osSupportStatus: string }): 'COMPLIANT' | 'NON_COMPLIANT' | 'UNKNOWN' {
  const values = [statuses.antivirusStatus, statuses.firewallStatus, statuses.encryptionStatus, statuses.patchStatus, statuses.osSupportStatus];
  if (values.some((v) => v === 'UNKNOWN')) return 'UNKNOWN';
  return values.every((v) => v === 'COMPLIANT') ? 'COMPLIANT' : 'NON_COMPLIANT';
}

export interface RecordComplianceInput {
  assetId: string;
  antivirusStatus: string;
  firewallStatus: string;
  encryptionStatus: string;
  patchStatus: string;
  osSupportStatus: string;
}

export async function recordCompliance(input: RecordComplianceInput): Promise<string> {
  const overall = computeOverallStatus(input);
  const id = newId();
  await db.insert(endpointCompliance).values({ id, ...input, overall });
  return id;
}

export async function listCompliance(companyId: string) {
  return db
    .select({ id: endpointCompliance.id, assetTag: itAssets.assetTag, assetName: itAssets.name, overall: endpointCompliance.overall, antivirusStatus: endpointCompliance.antivirusStatus, firewallStatus: endpointCompliance.firewallStatus, encryptionStatus: endpointCompliance.encryptionStatus, patchStatus: endpointCompliance.patchStatus, osSupportStatus: endpointCompliance.osSupportStatus, checkedAt: endpointCompliance.checkedAt })
    .from(endpointCompliance)
    .innerJoin(itAssets, eq(itAssets.id, endpointCompliance.assetId))
    .where(eq(itAssets.companyId, companyId))
    .orderBy(desc(endpointCompliance.checkedAt));
}
