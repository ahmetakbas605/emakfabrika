import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { problems, problemIncidents, incidents, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

export interface CreateProblemInput {
  title: string;
  openedByUserId: string;
}

export async function createProblem(companyId: string, input: CreateProblemInput): Promise<string> {
  const id = newId();
  await db.insert(problems).values({ id, companyId, title: input.title, openedByUserId: input.openedByUserId });
  return id;
}

export async function listProblems(companyId: string) {
  return db
    .select({ id: problems.id, title: problems.title, status: problems.status, rootCause: problems.rootCause, openedByName: users.fullName, createdAt: problems.createdAt })
    .from(problems)
    .innerJoin(users, eq(users.id, problems.openedByUserId))
    .where(eq(problems.companyId, companyId))
    .orderBy(desc(problems.createdAt));
}

export async function linkIncidentToProblem(companyId: string, problemId: string, incidentId: string): Promise<void> {
  const [problem] = await db.select({ id: problems.id }).from(problems).where(and(eq(problems.id, problemId), eq(problems.companyId, companyId))).limit(1);
  if (!problem) throw new ItError('Problem bulunamadı.');
  const [incident] = await db.select({ id: incidents.id }).from(incidents).where(and(eq(incidents.id, incidentId), eq(incidents.companyId, companyId))).limit(1);
  if (!incident) throw new ItError('Incident bulunamadı.');

  await db.insert(problemIncidents).values({ problemId, incidentId }).onDuplicateKeyUpdate({ set: { problemId } });
}

export async function listProblemIncidents(problemId: string) {
  return db
    .select({ id: incidents.id, title: incidents.title, severity: incidents.severity, status: incidents.status })
    .from(problemIncidents)
    .innerJoin(incidents, eq(incidents.id, problemIncidents.incidentId))
    .where(eq(problemIncidents.problemId, problemId));
}

// SERVICE-DESK.md §5 — problem kapandığında bağlı incident'lar OTOMATİK
// kapanmaz, yalnızca problems.status değişir (bilinçli, PDF'in kendi kararı).
export async function updateProblem(companyId: string, problemId: string, toStatus: (typeof problems.$inferInsert)['status'], rootCause?: string): Promise<void> {
  await db.update(problems).set({ status: toStatus, ...(rootCause !== undefined ? { rootCause } : {}) }).where(and(eq(problems.id, problemId), eq(problems.companyId, companyId)));
}
