import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { ncrRecords, parties, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { publishEventInTx, dispatchEvent } from '@/lib/integration/events';
import '@/lib/integration/subscribers';
import { QualityError } from './errors';

// Holding ERP Faz 5 (Kalite) — NCR/CAPA. lib/sales/complaints.ts İLE AYNI
// bilinçli kapsam kararı: bu bir onay zinciri DEĞİL (jenerik workflow
// motoruna BAĞLANMADI), bir soruşturma/düzeltme iş akışıdır — durum
// geçişleri, complaints'in status alanı gibi DOĞRUDAN aksiyon
// fonksiyonlarıyla (production'ın startProdOperation/completeProdOperation
// İLE AYNI isimlendirilmiş-fiil deseni) yürütülür, generic bir
// `setStatus(...)` ile DEĞİL — her fonksiyon kendi geçiş kuralını taşır.

export interface CreateNcrInput {
  inspectionId?: string;
  supplierPartyId?: string;
  productId?: string;
  title: string;
  description: string;
  severity?: (typeof ncrRecords.$inferInsert)['severity'];
  assignedToUserId?: string;
}

export async function createNcr(companyId: string, createdByUserId: string, input: CreateNcrInput): Promise<string> {
  const severity = input.severity ?? 'MINOR';
  const id = await db.transaction(async (tx) => {
    const id = newId();
    const ncrNo = await nextDocumentNo(tx, companyId, 'NCR', 'DUR', new Date().getFullYear(), 6);
    await tx.insert(ncrRecords).values({
      id, companyId, ncrNo, inspectionId: input.inspectionId, supplierPartyId: input.supplierPartyId, productId: input.productId,
      title: input.title, description: input.description, severity, assignedToUserId: input.assignedToUserId, createdByUserId
    });
    await publishEventInTx(tx, companyId, { eventType: 'QUALITY_NCR_CREATED', sourceModule: 'QUALITY', entityId: id, payload: { severity, title: input.title } });
    return id;
  });
  await dispatchEvent(companyId, 'QUALITY_NCR_CREATED', id, { severity, title: input.title });
  return id;
}

export interface ListNcrsFilter {
  status?: (typeof ncrRecords.$inferInsert)['status'];
  supplierPartyId?: string;
}

export async function listNcrs(companyId: string, filter?: ListNcrsFilter) {
  const conditions = [eq(ncrRecords.companyId, companyId)];
  if (filter?.status) conditions.push(eq(ncrRecords.status, filter.status));
  if (filter?.supplierPartyId) conditions.push(eq(ncrRecords.supplierPartyId, filter.supplierPartyId));
  return db
    .select({
      id: ncrRecords.id, ncrNo: ncrRecords.ncrNo, title: ncrRecords.title, severity: ncrRecords.severity, status: ncrRecords.status,
      supplierName: parties.legalName, productName: products.name, createdAt: ncrRecords.createdAt
    })
    .from(ncrRecords)
    .leftJoin(parties, eq(parties.id, ncrRecords.supplierPartyId))
    .leftJoin(products, eq(products.id, ncrRecords.productId))
    .where(and(...conditions))
    .orderBy(desc(ncrRecords.createdAt));
}

export async function getNcr(companyId: string, ncrId: string) {
  const [row] = await db.select().from(ncrRecords).where(and(eq(ncrRecords.id, ncrId), eq(ncrRecords.companyId, companyId))).limit(1);
  if (!row) throw new QualityError('NCR kaydı bulunamadı.');
  return row;
}

export async function startNcrInvestigation(companyId: string, ncrId: string): Promise<void> {
  const ncr = await getNcr(companyId, ncrId);
  if (ncr.status !== 'OPEN') throw new QualityError('Yalnızca açık (OPEN) bir NCR soruşturmaya alınabilir.');
  await db.update(ncrRecords).set({ status: 'INVESTIGATING' }).where(eq(ncrRecords.id, ncrId));
}

export async function recordNcrRootCause(companyId: string, ncrId: string, rootCause: string): Promise<void> {
  const ncr = await getNcr(companyId, ncrId);
  if (ncr.status !== 'INVESTIGATING') throw new QualityError('Kök neden yalnızca soruşturma (INVESTIGATING) aşamasında kaydedilebilir.');
  await db.update(ncrRecords).set({ rootCause, status: 'CORRECTIVE_ACTION' }).where(eq(ncrRecords.id, ncrId));
}

export interface RecordNcrActionsInput {
  correctiveAction: string;
  preventiveAction: string;
}

export async function recordNcrActions(companyId: string, ncrId: string, input: RecordNcrActionsInput): Promise<void> {
  const ncr = await getNcr(companyId, ncrId);
  if (ncr.status !== 'CORRECTIVE_ACTION') throw new QualityError('Düzeltici/önleyici faaliyet yalnızca CORRECTIVE_ACTION aşamasında kaydedilebilir.');
  await db.update(ncrRecords).set({ correctiveAction: input.correctiveAction, preventiveAction: input.preventiveAction, status: 'VERIFICATION' }).where(eq(ncrRecords.id, ncrId));
}

export async function closeNcr(companyId: string, ncrId: string): Promise<void> {
  const ncr = await getNcr(companyId, ncrId);
  if (ncr.status !== 'VERIFICATION') throw new QualityError('Yalnızca doğrulama (VERIFICATION) aşamasındaki bir NCR kapatılabilir.');
  await db.update(ncrRecords).set({ status: 'CLOSED', closedAt: new Date() }).where(eq(ncrRecords.id, ncrId));
}

export async function rejectNcr(companyId: string, ncrId: string): Promise<void> {
  const ncr = await getNcr(companyId, ncrId);
  if (ncr.status === 'CLOSED' || ncr.status === 'REJECTED') throw new QualityError('Zaten sonuçlanmış (CLOSED/REJECTED) bir NCR tekrar reddedilemez.');
  await db.update(ncrRecords).set({ status: 'REJECTED', closedAt: new Date() }).where(eq(ncrRecords.id, ncrId));
}
