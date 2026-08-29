import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { changes, changeApprovals, users, CHANGE_LEVELS } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// SERVICE-DESK.md §6 — risk × impact eşiği onay gerekip gerekmediğini
// belirler. TODO: CHANGE_APPROVAL_THRESHOLD_CONFIG — bugün sabit, madde
// 61'in "parametrik kurallar" ilkesine göre ileride tenant bazlı yapılacak.
const LEVEL_RANK: Record<(typeof CHANGE_LEVELS)[number], number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function requiresApproval(riskLevel: (typeof CHANGE_LEVELS)[number], impactLevel: (typeof CHANGE_LEVELS)[number]): boolean {
  return LEVEL_RANK[riskLevel] >= LEVEL_RANK.HIGH || LEVEL_RANK[impactLevel] >= LEVEL_RANK.HIGH;
}

export interface CreateChangeInput {
  title: string;
  description?: string;
  riskLevel: (typeof CHANGE_LEVELS)[number];
  impactLevel: (typeof CHANGE_LEVELS)[number];
  requestedByUserId: string;
  scheduledAt?: string;
}

export async function createChange(companyId: string, input: CreateChangeInput): Promise<string> {
  const id = newId();
  await db.insert(changes).values({
    id, companyId, title: input.title, description: input.description ?? '',
    riskLevel: input.riskLevel, impactLevel: input.impactLevel, status: 'DRAFT',
    requestedByUserId: input.requestedByUserId, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined
  });
  return id;
}

export async function listChanges(companyId: string) {
  return db
    .select({ id: changes.id, title: changes.title, riskLevel: changes.riskLevel, impactLevel: changes.impactLevel, status: changes.status, requestedByName: users.fullName, scheduledAt: changes.scheduledAt, createdAt: changes.createdAt })
    .from(changes)
    .innerJoin(users, eq(users.id, changes.requestedByUserId))
    .where(eq(changes.companyId, companyId))
    .orderBy(desc(changes.createdAt));
}

export async function listChangeApprovals(changeId: string) {
  return db
    .select({ id: changeApprovals.id, approvedByName: users.fullName, decision: changeApprovals.decision, note: changeApprovals.note, createdAt: changeApprovals.createdAt })
    .from(changeApprovals)
    .innerJoin(users, eq(users.id, changeApprovals.approvedByUserId))
    .where(eq(changeApprovals.changeId, changeId))
    .orderBy(desc(changeApprovals.createdAt));
}

export async function recordApproval(companyId: string, changeId: string, approvedByUserId: string, decision: 'APPROVED' | 'REJECTED', note?: string): Promise<void> {
  const [change] = await db.select({ id: changes.id, status: changes.status }).from(changes).where(and(eq(changes.id, changeId), eq(changes.companyId, companyId))).limit(1);
  if (!change) throw new ItError('Değişiklik bulunamadı.');
  if (change.status !== 'DRAFT') throw new ItError('Yalnızca taslak durumundaki bir değişiklik onaylanabilir/reddedilebilir.');

  await db.insert(changeApprovals).values({ id: newId(), changeId, approvedByUserId, decision, note });
  if (decision === 'REJECTED') {
    await db.update(changes).set({ status: 'CANCELLED' }).where(eq(changes.id, changeId));
  }
}

// SERVICE-DESK.md §6 — LOW risk + LOW impact onaysız SCHEDULED'a geçebilir;
// HIGH/CRITICAL en az bir APPROVED kaydı olmadan SCHEDULED'a geçemez.
export async function scheduleChange(companyId: string, changeId: string): Promise<void> {
  const [change] = await db.select().from(changes).where(and(eq(changes.id, changeId), eq(changes.companyId, companyId))).limit(1);
  if (!change) throw new ItError('Değişiklik bulunamadı.');
  if (change.status !== 'DRAFT') throw new ItError('Yalnızca taslak durumundaki bir değişiklik planlanabilir.');

  if (requiresApproval(change.riskLevel, change.impactLevel)) {
    const approvals = await db.select({ decision: changeApprovals.decision }).from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
    if (!approvals.some((a) => a.decision === 'APPROVED')) {
      throw new ItError('Bu risk/etki seviyesindeki değişiklik, en az bir onay kaydı olmadan planlanamaz.');
    }
  }

  await db.update(changes).set({ status: 'SCHEDULED' }).where(eq(changes.id, changeId));
}

export async function updateChangeStatus(companyId: string, changeId: string, toStatus: (typeof changes.$inferInsert)['status']): Promise<void> {
  await db.update(changes).set({ status: toStatus }).where(and(eq(changes.id, changeId), eq(changes.companyId, companyId)));
}
