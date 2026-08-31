import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { legalCollaterals, legalContracts } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { LegalError } from './errors';

export interface CreateCollateralInput {
  contractId?: string;
  collateralType: (typeof legalCollaterals.$inferInsert)['collateralType'];
  amount: number;
  currencyCode?: string;
  provider?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export async function createCollateral(companyId: string, createdByUserId: string, input: CreateCollateralInput): Promise<string> {
  if (input.contractId) {
    const [contract] = await db.select({ id: legalContracts.id }).from(legalContracts).where(and(eq(legalContracts.id, input.contractId), eq(legalContracts.companyId, companyId))).limit(1);
    if (!contract) throw new LegalError('Sözleşme bulunamadı.');
  }
  if (input.expiryDate && input.issueDate && input.expiryDate < input.issueDate) throw new LegalError('Son kullanma tarihi düzenleme tarihinden önce olamaz.');

  const id = newId();
  await db.insert(legalCollaterals).values({
    id, companyId, contractId: input.contractId, collateralType: input.collateralType, amount: toDb(input.amount), currencyCode: input.currencyCode,
    provider: input.provider ?? '', issueDate: input.issueDate, expiryDate: input.expiryDate, notes: input.notes, createdByUserId
  });
  return id;
}

export async function listCollaterals(companyId: string, contractId?: string) {
  const conditions = contractId ? and(eq(legalCollaterals.companyId, companyId), eq(legalCollaterals.contractId, contractId)) : eq(legalCollaterals.companyId, companyId);
  return db
    .select({
      id: legalCollaterals.id, contractId: legalCollaterals.contractId, contractNo: legalContracts.contractNo, collateralType: legalCollaterals.collateralType,
      amount: legalCollaterals.amount, provider: legalCollaterals.provider, expiryDate: legalCollaterals.expiryDate, status: legalCollaterals.status
    })
    .from(legalCollaterals)
    .leftJoin(legalContracts, eq(legalContracts.id, legalCollaterals.contractId))
    .where(conditions)
    .orderBy(desc(legalCollaterals.createdAt));
}

async function getCollateral(companyId: string, collateralId: string) {
  const [row] = await db.select().from(legalCollaterals).where(and(eq(legalCollaterals.id, collateralId), eq(legalCollaterals.companyId, companyId))).limit(1);
  if (!row) throw new LegalError('Teminat kaydı bulunamadı.');
  return row;
}

export async function releaseCollateral(companyId: string, collateralId: string): Promise<void> {
  const collateral = await getCollateral(companyId, collateralId);
  if (collateral.status !== 'ACTIVE') throw new LegalError('Yalnızca aktif (ACTIVE) bir teminat serbest bırakılabilir.');
  await db.update(legalCollaterals).set({ status: 'RELEASED' }).where(eq(legalCollaterals.id, collateralId));
}
