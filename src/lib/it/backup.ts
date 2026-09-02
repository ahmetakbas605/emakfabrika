import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { backupJobs, backupResults, itAssets } from '@/db/schema';
import { newId } from '@/lib/id';
import { createAlert, getOrCreateAssetMonitorTarget } from '@/lib/it/monitoring';
import { ItError } from './errors';

export interface CreateBackupJobInput {
  assetId: string;
  source: string;
  destination: string;
  schedule?: string;
  retentionDays?: number;
  encryption?: boolean;
}

export async function createBackupJob(companyId: string, input: CreateBackupJobInput): Promise<string> {
  const id = newId();
  await db.insert(backupJobs).values({ id, companyId, ...input });
  return id;
}

export async function listBackupJobs(companyId: string) {
  return db.select({ id: backupJobs.id, source: backupJobs.source, destination: backupJobs.destination, schedule: backupJobs.schedule, retentionDays: backupJobs.retentionDays, assetTag: itAssets.assetTag })
    .from(backupJobs).innerJoin(itAssets, eq(itAssets.id, backupJobs.assetId)).where(eq(backupJobs.companyId, companyId));
}

export interface RecordBackupResultInput {
  backupJobId: string;
  startedAt: Date;
  finishedAt?: Date;
  result: (typeof backupResults.$inferInsert)['result'];
  sizeBytes?: number | string;
  errorMessage?: string;
}

// MONITORING.md §6 — result='FAILED' -> OTOMATİK bir HIGH-severity alert
// üretir, aynı zincirden (lib/it/monitoring.ts:createAlert) Incident'a
// gidebilir (madde 75'in kendi isteği).
export async function recordBackupResult(companyId: string, requestedByUserId: string, input: RecordBackupResultInput): Promise<string> {
  const [job] = await db.select({ assetId: backupJobs.assetId, source: backupJobs.source }).from(backupJobs).where(and(eq(backupJobs.id, input.backupJobId), eq(backupJobs.companyId, companyId))).limit(1);
  if (!job) throw new ItError('Yedekleme işi bulunamadı.');

  const id = newId();
  await db.insert(backupResults).values({ id, backupJobId: input.backupJobId, startedAt: input.startedAt, finishedAt: input.finishedAt, result: input.result, sizeBytes: input.sizeBytes !== undefined ? String(input.sizeBytes) : undefined, errorMessage: input.errorMessage });

  if (input.result === 'FAILED') {
    const targetId = await getOrCreateAssetMonitorTarget(companyId, job.assetId);
    await createAlert(companyId, requestedByUserId, targetId, 'HIGH', `Yedekleme başarısız — ${job.source}${input.errorMessage ? `: ${input.errorMessage}` : ''}`);
  }
  return id;
}

export async function listBackupResults(companyId: string, backupJobId: string) {
  const [job] = await db.select({ id: backupJobs.id }).from(backupJobs).where(and(eq(backupJobs.id, backupJobId), eq(backupJobs.companyId, companyId))).limit(1);
  if (!job) throw new ItError('Yedekleme işi bulunamadı.');
  return db.select().from(backupResults).where(eq(backupResults.backupJobId, backupJobId)).orderBy(desc(backupResults.startedAt));
}
