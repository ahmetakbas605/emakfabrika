import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { rndLabTests, rndPrototypes } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { RndError } from './errors';

export interface CreateLabTestInput {
  prototypeId?: string;
  testName: string;
  testDate?: string;
  performedByUserId?: string;
}

export async function createLabTest(companyId: string, input: CreateLabTestInput): Promise<string> {
  if (input.prototypeId) {
    const [prototype] = await db.select({ id: rndPrototypes.id }).from(rndPrototypes).where(and(eq(rndPrototypes.id, input.prototypeId), eq(rndPrototypes.companyId, companyId))).limit(1);
    if (!prototype) throw new RndError('Prototip bulunamadı.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const testNo = await nextDocumentNo(tx, companyId, 'RNDT', 'LAB', new Date().getFullYear(), 6);
    await tx.insert(rndLabTests).values({ id, companyId, prototypeId: input.prototypeId, testNo, testName: input.testName, testDate: input.testDate, performedByUserId: input.performedByUserId });
    return id;
  });
}

export async function listLabTests(companyId: string) {
  return db
    .select({
      id: rndLabTests.id, testNo: rndLabTests.testNo, testName: rndLabTests.testName, testDate: rndLabTests.testDate,
      status: rndLabTests.status, prototypeName: rndPrototypes.name
    })
    .from(rndLabTests)
    .leftJoin(rndPrototypes, eq(rndPrototypes.id, rndLabTests.prototypeId))
    .where(eq(rndLabTests.companyId, companyId))
    .orderBy(desc(rndLabTests.createdAt));
}

async function getLabTest(companyId: string, testId: string) {
  const [row] = await db.select().from(rndLabTests).where(and(eq(rndLabTests.id, testId), eq(rndLabTests.companyId, companyId))).limit(1);
  if (!row) throw new RndError('Laboratuvar testi bulunamadı.');
  return row;
}

const TERMINAL_LAB_TEST_STATUSES = ['COMPLETED', 'FAILED'] as const;

export interface UpdateLabTestStatusInput {
  status: (typeof rndLabTests.$inferSelect)['status'];
  resultSummary?: string;
}

export async function updateLabTestStatus(companyId: string, testId: string, input: UpdateLabTestStatusInput): Promise<void> {
  const test = await getLabTest(companyId, testId);
  if ((TERMINAL_LAB_TEST_STATUSES as readonly string[]).includes(test.status)) throw new RndError('Tamamlanmış/başarısız bir testin durumu değiştirilemez.');
  await db.update(rndLabTests).set({ status: input.status, resultSummary: input.resultSummary }).where(eq(rndLabTests.id, testId));
}
