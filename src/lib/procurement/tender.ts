import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { procTenders, procTenderLines, procTenderSuppliers, parties, units, products } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { ProcurementError } from './errors';

// Satınalma Faz 8A — İhale (Tender) platform temeli. proc_rfqs/proc_rfq_lines/
// proc_rfq_suppliers'ın (Faz 2, lib/procurement/rfq.ts) NEREDEYSE BİREBİR
// aynı şekli — kapalı teklif toplama + açılış (Faz 8B) henüz YOK, bu dosya
// yalnızca ihale başlığı/kalemleri/davetli tedarikçi yaşam döngüsünü kurar.

export interface CreateTenderLineInput {
  srcRequestLineId?: string;
  productId?: string;
  description: string;
  quantity: number | string;
  unitId: string;
}

export interface CreateTenderInput {
  title: string;
  description?: string;
  bidSubmissionDeadline?: Date;
  bidOpeningAt?: Date;
  deliveryLocation?: string;
  paymentTerms?: string;
  warrantyRequirement?: string;
  bidBondRequired?: boolean;
  bidBondPercent?: number | string;
  bidBondAmount?: number | string;
  openParticipation?: boolean;
  notes?: string;
  lines: CreateTenderLineInput[];
  supplierPartyIds: string[];
}

export async function createTender(companyId: string, createdByUserId: string, input: CreateTenderInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir kalem gerekli.');
  if (!input.openParticipation && input.supplierPartyIds.length === 0) {
    throw new ProcurementError('Davetli katılımlı bir ihalede en az bir tedarikçi davet edilmeli.');
  }
  if (input.bidSubmissionDeadline && input.bidOpeningAt && input.bidOpeningAt < input.bidSubmissionDeadline) {
    throw new ProcurementError('Açılış anı, teklif son tarihinden ÖNCE olamaz.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const tenderNo = await nextDocumentNo(tx, companyId, 'TND', 'TND', new Date().getFullYear(), 4);
    await tx.insert(procTenders).values({
      id, companyId, tenderNo, title: input.title, description: input.description,
      bidSubmissionDeadline: input.bidSubmissionDeadline, bidOpeningAt: input.bidOpeningAt,
      deliveryLocation: input.deliveryLocation ?? '', paymentTerms: input.paymentTerms ?? '', warrantyRequirement: input.warrantyRequirement ?? '',
      bidBondRequired: input.bidBondRequired ?? false,
      bidBondPercent: input.bidBondPercent === undefined ? undefined : toDb(input.bidBondPercent),
      bidBondAmount: input.bidBondAmount === undefined ? undefined : toDb(input.bidBondAmount),
      openParticipation: input.openParticipation ?? false,
      notes: input.notes, createdByUserId
    });

    for (const line of input.lines) {
      await tx.insert(procTenderLines).values({
        id: newId(), tenderId: id, srcRequestLineId: line.srcRequestLineId, productId: line.productId,
        description: line.description, quantity: toDb(line.quantity), unitId: line.unitId
      });
    }

    for (const supplierPartyId of input.supplierPartyIds) {
      const [supplier] = await tx.select({ id: parties.id }).from(parties).where(and(eq(parties.id, supplierPartyId), eq(parties.companyId, companyId))).limit(1);
      if (!supplier) throw new ProcurementError('Tedarikçi bulunamadı.');
      await tx.insert(procTenderSuppliers).values({ id: newId(), tenderId: id, supplierPartyId });
    }

    return id;
  });
}

export async function listTenders(companyId: string) {
  return db
    .select({ id: procTenders.id, tenderNo: procTenders.tenderNo, title: procTenders.title, status: procTenders.status, bidSubmissionDeadline: procTenders.bidSubmissionDeadline, bidOpeningAt: procTenders.bidOpeningAt, createdAt: procTenders.createdAt })
    .from(procTenders)
    .where(eq(procTenders.companyId, companyId))
    .orderBy(desc(procTenders.createdAt));
}

export async function getTender(companyId: string, tenderId: string) {
  const [tender] = await db.select().from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');

  const lines = await db
    .select({ id: procTenderLines.id, description: procTenderLines.description, quantity: procTenderLines.quantity, unitId: procTenderLines.unitId, unitCode: units.code, productId: procTenderLines.productId, productSku: products.sku })
    .from(procTenderLines)
    .innerJoin(units, eq(units.id, procTenderLines.unitId))
    .leftJoin(products, eq(products.id, procTenderLines.productId))
    .where(eq(procTenderLines.tenderId, tenderId));

  const suppliers = await db
    .select({ id: procTenderSuppliers.id, supplierPartyId: procTenderSuppliers.supplierPartyId, supplierName: parties.legalName, status: procTenderSuppliers.status, invitedAt: procTenderSuppliers.invitedAt })
    .from(procTenderSuppliers)
    .innerJoin(parties, eq(parties.id, procTenderSuppliers.supplierPartyId))
    .where(eq(procTenderSuppliers.tenderId, tenderId));

  return { tender, lines, suppliers };
}

// madde (İhale Kapsamı raporu §3) — yayınlama, sendRfq (Faz 2) İLE AYNI
// gerekçeyle bir onay akışından GEÇMEZ: harcama taahhüdü Award aşamasında
// (Faz 4'ün genelleneceği Faz 8C) kuruluyor, yayınlamanın kendisi henüz
// bir taahhüt değil.
export async function publishTender(companyId: string, tenderId: string): Promise<void> {
  const [tender] = await db.select({ id: procTenders.id, status: procTenders.status }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir ihale yayınlanabilir.');
  await db.update(procTenders).set({ status: 'PUBLISHED', publishedAt: new Date() }).where(eq(procTenders.id, tenderId));
}

export async function cancelTender(companyId: string, tenderId: string): Promise<void> {
  const [tender] = await db.select({ id: procTenders.id, status: procTenders.status }).from(procTenders).where(and(eq(procTenders.id, tenderId), eq(procTenders.companyId, companyId))).limit(1);
  if (!tender) throw new ProcurementError('İhale bulunamadı.');
  if (tender.status === 'CANCELLED') throw new ProcurementError('İhale zaten iptal edilmiş.');
  await db.update(procTenders).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(eq(procTenders.id, tenderId));
}
