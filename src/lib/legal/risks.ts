import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { riskRegisterEntries, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { LegalError } from './errors';

// madde metninin kendi formülü: probability×impact×score×owner×mitigation.
// score her zaman probability×impact olarak BURADA hesaplanır — kullanıcı
// elle giremez (schema.ts'in kendi yorumu).
function computeScore(probability: number, impact: number): number {
  return probability * impact;
}

export interface CreateRiskInput {
  title: string;
  category: (typeof riskRegisterEntries.$inferInsert)['category'];
  description?: string;
  probability: number;
  impact: number;
  ownerUserId?: string;
  mitigation?: string;
}

function validateScale(probability: number, impact: number): void {
  if (probability < 1 || probability > 5) throw new LegalError('Olasılık (probability) 1-5 aralığında olmalı.');
  if (impact < 1 || impact > 5) throw new LegalError('Etki (impact) 1-5 aralığında olmalı.');
}

export async function createRisk(companyId: string, createdByUserId: string, input: CreateRiskInput): Promise<string> {
  validateScale(input.probability, input.impact);

  return db.transaction(async (tx) => {
    const id = newId();
    const riskNo = await nextDocumentNo(tx, companyId, 'RISK', 'RSK', new Date().getFullYear(), 6);
    await tx.insert(riskRegisterEntries).values({
      id, companyId, riskNo, title: input.title, category: input.category, description: input.description,
      probability: input.probability, impact: input.impact, score: computeScore(input.probability, input.impact),
      ownerUserId: input.ownerUserId, mitigation: input.mitigation, createdByUserId
    });
    return id;
  });
}

export async function listRisks(companyId: string) {
  return db
    .select({
      id: riskRegisterEntries.id, riskNo: riskRegisterEntries.riskNo, title: riskRegisterEntries.title, category: riskRegisterEntries.category,
      probability: riskRegisterEntries.probability, impact: riskRegisterEntries.impact, score: riskRegisterEntries.score,
      ownerName: users.fullName, status: riskRegisterEntries.status
    })
    .from(riskRegisterEntries)
    .leftJoin(users, eq(users.id, riskRegisterEntries.ownerUserId))
    .where(eq(riskRegisterEntries.companyId, companyId))
    .orderBy(desc(riskRegisterEntries.score));
}

export async function getRisk(companyId: string, riskId: string) {
  const [row] = await db.select().from(riskRegisterEntries).where(and(eq(riskRegisterEntries.id, riskId), eq(riskRegisterEntries.companyId, companyId))).limit(1);
  if (!row) throw new LegalError('Risk kaydı bulunamadı.');
  return row;
}

export interface UpdateRiskAssessmentInput {
  probability: number;
  impact: number;
  mitigation?: string;
}

// Değerlendirme (probability/impact) her güncellendiğinde score BURADA
// yeniden hesaplanır — asla elle set edilmez, tutarsızlık riski YOK. Durum
// (OPEN/MITIGATING) BURADA değişmez — startRiskMitigation ayrı, açık bir
// geçiş (lib/quality/ncr.ts'nin isimlendirilmiş-fiil deseniyle AYNI).
export async function updateRiskAssessment(companyId: string, riskId: string, input: UpdateRiskAssessmentInput): Promise<void> {
  const risk = await getRisk(companyId, riskId);
  if (risk.status === 'CLOSED') throw new LegalError('Kapatılmış bir risk kaydı güncellenemez.');
  validateScale(input.probability, input.impact);
  await db.update(riskRegisterEntries).set({
    probability: input.probability, impact: input.impact, score: computeScore(input.probability, input.impact), mitigation: input.mitigation
  }).where(eq(riskRegisterEntries.id, riskId));
}

export async function startRiskMitigation(companyId: string, riskId: string): Promise<void> {
  const risk = await getRisk(companyId, riskId);
  if (risk.status !== 'OPEN') throw new LegalError('Yalnızca açık (OPEN) bir risk azaltma sürecine alınabilir.');
  await db.update(riskRegisterEntries).set({ status: 'MITIGATING' }).where(eq(riskRegisterEntries.id, riskId));
}

export async function closeRisk(companyId: string, riskId: string): Promise<void> {
  const risk = await getRisk(companyId, riskId);
  if (risk.status === 'CLOSED') throw new LegalError('Bu risk kaydı zaten kapatılmış.');
  await db.update(riskRegisterEntries).set({ status: 'CLOSED', closedAt: new Date() }).where(eq(riskRegisterEntries.id, riskId));
}
