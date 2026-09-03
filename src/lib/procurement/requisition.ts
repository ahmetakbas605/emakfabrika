import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { procRequests, procRequestLines, users, approvalSteps, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { nextDocumentNo } from '@/lib/numbering';
import { getAvailableQuantityInTx, reserveStockInTx, releaseReservationInTx } from '@/lib/warehouse';
import { createBudgetCommitmentInTx, getBudgetItemAvailabilityInTx, releaseBudgetCommitmentInTx } from '@/lib/budgets';
import { startApprovalInTx, actOnStepInTx, getApprovalInstance, type ApprovalDecision } from '@/lib/workflow/engine';
import { listAttachments, uploadAttachment, type UploadAttachmentInput } from '@/lib/documents/attachments';
import { ProcurementError } from './errors';

// SATINALMA-MİMARİSİ Faz 1 — Purchase Requisition (madde 12-28). Faz 0'ın
// platform temelini TÜKETİR: numaralama, workflow, ek dosya, bütçe
// taahhüdü, stok rezervasyonu — HİÇBİRİ için yeni altyapı YOK.

export interface CreateProcRequestLineInput {
  productId?: string;
  stockItemId?: string;
  description: string;
  quantity: number | string;
  unitId: string;
  preferredBrand?: string;
  alternativeBrand?: string;
  model?: string;
  technicalSpec?: Record<string, unknown>;
  estimatedUnitPrice?: number | string;
  warehouseId?: string;
  deliveryLocation?: string;
}

export interface CreateProcRequestInput {
  departmentId?: string;
  requestType?: (typeof procRequests.$inferInsert)['requestType'];
  priority?: (typeof procRequests.$inferInsert)['priority'];
  costCenterId?: string;
  budgetItemId?: string;
  // Holding ERP Faz 8 (Proje Yönetimi) — costCenterId/budgetItemId İLE AYNI
  // opsiyonel-entegrasyon deseni, MASTER-ERP-ROADMAP.md'nin "Satın Alma'nın
  // proje-bazlı taleplerine bağlanabilir" kararının gerçek karşılığı.
  // Satın Alma'nın KENDİ akışı (onay/mal kabul/3-way-match) HİÇ değişmedi.
  projectId?: string;
  capexOpex?: 'CAPEX' | 'OPEX';
  requestedDeliveryDate?: string;
  justification?: string;
  currencyCode?: string;
  lines: CreateProcRequestLineInput[];
}

function computeLineTotal(quantity: number | string, unitPrice?: number | string): string | undefined {
  if (unitPrice === undefined) return undefined;
  return toDb(money(quantity).times(money(unitPrice)));
}

export async function createProcRequest(companyId: string, requestedByUserId: string, input: CreateProcRequestInput): Promise<string> {
  if (input.lines.length === 0) throw new ProcurementError('En az bir talep kalemi gerekli.');
  for (const line of input.lines) {
    // madde 20-22'nin gerçek bir stok kontrolü yapabilmesi için stockItemId
    // İLE warehouseId BİRLİKTE gelmeli — biri olup diğeri eksikse, hangi
    // depoda kontrol edileceği belirsiz kalır (NEW_PURCHASE_REQUIRED'a düşer,
    // hata değil, bkz. submitProcRequest).
    if (line.stockItemId && !line.warehouseId) throw new ProcurementError('Stok kartı seçilen bir satırda depo da belirtilmeli.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const requestNo = await nextDocumentNo(tx, companyId, 'PR', 'PR', new Date().getFullYear(), 6);

    const lineTotals = input.lines.map((l) => computeLineTotal(l.quantity, l.estimatedUnitPrice));
    const estimatedTotal = lineTotals.some((t) => t !== undefined) ? toDb(lineTotals.reduce((acc: ReturnType<typeof money>, t) => acc.plus(money(t ?? 0)), money(0))) : undefined;

    await tx.insert(procRequests).values({
      id, companyId,
      departmentId: input.departmentId,
      requestNo,
      requestType: input.requestType ?? 'NORMAL',
      priority: input.priority ?? 'NORMAL',
      status: 'DRAFT',
      requestedByUserId,
      costCenterId: input.costCenterId,
      budgetItemId: input.budgetItemId,
      projectId: input.projectId,
      capexOpex: input.capexOpex,
      requestedDeliveryDate: input.requestedDeliveryDate,
      justification: input.justification,
      estimatedTotal,
      currencyCode: input.currencyCode
    });

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      await tx.insert(procRequestLines).values({
        id: newId(),
        requestId: id,
        lineNo: i + 1,
        productId: line.productId,
        stockItemId: line.stockItemId,
        description: line.description,
        quantity: toDb(line.quantity),
        unitId: line.unitId,
        preferredBrand: line.preferredBrand ?? '',
        alternativeBrand: line.alternativeBrand ?? '',
        model: line.model ?? '',
        technicalSpec: line.technicalSpec ?? {},
        estimatedUnitPrice: line.estimatedUnitPrice === undefined ? undefined : toDb(line.estimatedUnitPrice),
        estimatedTotal: computeLineTotal(line.quantity, line.estimatedUnitPrice),
        warehouseId: line.warehouseId,
        deliveryLocation: line.deliveryLocation ?? '',
        stockStatus: 'PENDING'
      });
    }

    return id;
  });
}

export interface ListProcRequestsFilter {
  status?: (typeof procRequests.$inferInsert)['status'];
  requestedByUserId?: string;
}

export async function listProcRequests(companyId: string, filter?: ListProcRequestsFilter) {
  const conditions = [eq(procRequests.companyId, companyId)];
  if (filter?.status) conditions.push(eq(procRequests.status, filter.status));
  if (filter?.requestedByUserId) conditions.push(eq(procRequests.requestedByUserId, filter.requestedByUserId));

  return db
    .select({
      id: procRequests.id, requestNo: procRequests.requestNo, requestType: procRequests.requestType, priority: procRequests.priority,
      status: procRequests.status, requestedByName: users.fullName, estimatedTotal: procRequests.estimatedTotal, currencyCode: procRequests.currencyCode,
      createdAt: procRequests.createdAt, submittedAt: procRequests.submittedAt
    })
    .from(procRequests)
    .innerJoin(users, eq(users.id, procRequests.requestedByUserId))
    .where(and(...conditions))
    .orderBy(desc(procRequests.createdAt));
}

export async function getProcRequest(companyId: string, requestId: string) {
  const [request] = await db.select().from(procRequests).where(and(eq(procRequests.id, requestId), eq(procRequests.companyId, companyId))).limit(1);
  if (!request) throw new ProcurementError('Talep bulunamadı.');

  const lines = await db.select().from(procRequestLines).where(eq(procRequestLines.requestId, requestId)).orderBy(procRequestLines.lineNo);
  const linesWithAttachments = await Promise.all(lines.map(async (line) => ({ ...line, attachments: await listAttachments(companyId, 'PROC_REQUEST_LINE', line.id) })));

  const approval = await getApprovalInstance(companyId, 'PROCUREMENT_REQUISITION', requestId);

  return { request, lines: linesWithAttachments, approval };
}

export async function cancelProcRequest(companyId: string, requestId: string, userId: string): Promise<void> {
  const [request] = await db.select().from(procRequests).where(and(eq(procRequests.id, requestId), eq(procRequests.companyId, companyId))).limit(1);
  if (!request) throw new ProcurementError('Talep bulunamadı.');
  if (request.status !== 'DRAFT') throw new ProcurementError('Yalnızca taslak (DRAFT) bir talep iptal edilebilir.');
  if (request.requestedByUserId !== userId) throw new ProcurementError('Yalnızca talebi oluşturan kişi iptal edebilir.');
  await db.update(procRequests).set({ status: 'CANCELLED' }).where(eq(procRequests.id, requestId));
}

// madde 20 — depo sorumlusunun ELLE düzeltmesi (submit sırasında otomatik
// hesaplanan durumun ÜZERİNE yazabilir, bkz. submitProcRequest yorumu).
export async function updateLineStockStatus(companyId: string, lineId: string, stockStatus: (typeof procRequestLines.$inferInsert)['stockStatus']): Promise<void> {
  const [line] = await db.select({ id: procRequestLines.id, requestId: procRequestLines.requestId }).from(procRequestLines).where(eq(procRequestLines.id, lineId)).limit(1);
  if (!line) throw new ProcurementError('Talep kalemi bulunamadı.');
  const [request] = await db.select({ id: procRequests.id }).from(procRequests).where(and(eq(procRequests.id, line.requestId), eq(procRequests.companyId, companyId))).limit(1);
  if (!request) throw new ProcurementError('Talep kalemi bulunamadı.');
  await db.update(procRequestLines).set({ stockStatus }).where(eq(procRequestLines.id, lineId));
}

// madde 25-28 — ek dosya, document_attachments'ı (Faz 0) DOĞRUDAN sarar,
// entityType='PROC_REQUEST_LINE' ile. Yeni bir tablo/mantık YOK.
export async function addProcRequestLineAttachment(companyId: string, lineId: string, input: Omit<UploadAttachmentInput, 'entityType' | 'entityId'>): Promise<string> {
  const [line] = await db.select({ id: procRequestLines.id, requestId: procRequestLines.requestId }).from(procRequestLines).where(eq(procRequestLines.id, lineId)).limit(1);
  if (!line) throw new ProcurementError('Talep kalemi bulunamadı.');
  const [request] = await db.select({ id: procRequests.id }).from(procRequests).where(and(eq(procRequests.id, line.requestId), eq(procRequests.companyId, companyId))).limit(1);
  if (!request) throw new ProcurementError('Talep kalemi bulunamadı.');
  return uploadAttachment(companyId, { ...input, entityType: 'PROC_REQUEST_LINE', entityId: lineId });
}

// --- Onaya gönderme: stok kontrolü + rezervasyon + bütçe taahhüdü +
// workflow başlatma — HEPSİ TEK transaction'da (recordStockMovementInTx'in
// transfer akışındaki AYNI atomiklik disiplini: yarım kalan bir "bazı
// satırlar rezerve edildi ama onay başlamadı" durumu OLUŞAMAZ). ---

export async function submitProcRequest(companyId: string, requestId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(procRequests).where(and(eq(procRequests.id, requestId), eq(procRequests.companyId, companyId))).limit(1);
    if (!request) throw new ProcurementError('Talep bulunamadı.');
    if (request.status !== 'DRAFT' && request.status !== 'REVISION_REQUIRED') throw new ProcurementError(`${request.status} durumundaki bir talep gönderilemez.`);

    const lines = await tx.select().from(procRequestLines).where(eq(procRequestLines.requestId, requestId));
    if (lines.length === 0) throw new ProcurementError('Talebin en az bir kalemi olmalı.');

    // madde 19-22 — stok kontrolü, submit ANINDA otomatik. stockItemId +
    // warehouseId İKİSİ de doluysa gerçek kontrol yapılır ve mevcutsa
    // rezervasyon oluşturulur; değilse NEW_PURCHASE_REQUIRED (satın alınacak).
    for (const line of lines) {
      if (line.stockItemId && line.warehouseId) {
        const available = await getAvailableQuantityInTx(tx, line.warehouseId, line.stockItemId);
        const requested = money(line.quantity);
        let stockStatus: (typeof procRequestLines.$inferInsert)['stockStatus'];
        let reservedQty = money(0);
        let purchaseQty = money(0);
        let reservationId: string | undefined;

        if (available.greaterThanOrEqualTo(requested)) {
          stockStatus = 'STOCK_AVAILABLE';
          reservedQty = requested;
        } else if (available.greaterThan(0)) {
          stockStatus = 'STOCK_PARTIAL';
          reservedQty = available;
          purchaseQty = requested.minus(available);
        } else {
          stockStatus = 'STOCK_UNAVAILABLE';
          purchaseQty = requested;
        }

        if (reservedQty.greaterThan(0)) {
          reservationId = await reserveStockInTx(tx, companyId, {
            warehouseId: line.warehouseId, stockItemId: line.stockItemId, quantity: toDb(reservedQty),
            sourceType: 'PROC_REQUEST_LINE', sourceId: line.id, createdByUserId: userId
          });
        }

        await tx.update(procRequestLines).set({ stockStatus, reservedQty: toDb(reservedQty), purchaseQty: toDb(purchaseQty), reservationId }).where(eq(procRequestLines.id, line.id));
      } else {
        await tx.update(procRequestLines).set({ stockStatus: 'NEW_PURCHASE_REQUIRED', reservedQty: '0', purchaseQty: line.quantity }).where(eq(procRequestLines.id, line.id));
      }
    }

    // madde 34-36 — bütçe kontrolü OPSİYONEL (budgetItemId boşsa atlanır,
    // stock_items.accountingAccountId İLE AYNI opsiyonel-entegrasyon deseni).
    let budgetCommitmentId: string | undefined;
    if (request.budgetItemId) {
      const amount = money(request.estimatedTotal ?? 0);
      const availability = await getBudgetItemAvailabilityInTx(tx, companyId, request.budgetItemId);
      if (money(availability.available).lessThan(amount)) {
        throw new ProcurementError(`Bütçe yetersiz — kullanılabilir: ${availability.available}, istenen: ${amount.toFixed(2)}.`);
      }
      budgetCommitmentId = await createBudgetCommitmentInTx(tx, { budgetItemId: request.budgetItemId, sourceType: 'PROC_REQUEST', sourceId: requestId, amount: toDb(amount), createdByUserId: userId });
    }

    await startApprovalInTx(tx, companyId, 'PROCUREMENT_REQUISITION', requestId, userId, {
      amount: request.estimatedTotal ? Number(request.estimatedTotal) : undefined,
      capexOpex: request.capexOpex ?? undefined,
      departmentId: request.departmentId ?? undefined,
      costCenterId: request.costCenterId ?? undefined
    });

    await tx.update(procRequests).set({ status: 'SUBMITTED', submittedAt: new Date(), budgetCommitmentId }).where(eq(procRequests.id, requestId));
  });
}

// --- Onay kararı — genel workflow motorunu SARAR, sonucu talebin KENDİ
// durumuna (ve olumsuz sonuçta rezervasyon/taahhüdün serbest bırakılmasına)
// çevirir. Motor procurement'ı TANIMAZ, bu çeviri KATMANI burada yaşar
// (SATINALMA-MİMARİSİ raporunun domain mimarisi kararı). ---

export interface ActOnRequisitionStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string;
}

export async function actOnRequisitionStep(companyId: string, input: ActOnRequisitionStepInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [step] = await tx.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
    if (!step) throw new ProcurementError('Onay adımı bulunamadı.');
    // Güvenlik denetimi 2026-09-03, bulgu 2.7 — companyId filtresi eklendi
    // (şirket-dışı bir adımın varlığını/türünü sızdıran oracle kapatıldı).
    const [instance] = await tx.select({ documentId: approvalInstances.documentId, documentType: approvalInstances.documentType }).from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
    if (!instance || instance.documentType !== 'PROCUREMENT_REQUISITION') throw new ProcurementError('Bu adım bir satınalma talebine ait değil.');
    const requestId = instance.documentId;

    const result = await actOnStepInTx(tx, companyId, input);
    if (result.instanceStatus === 'IN_PROGRESS') return;

    const [request] = await tx.select().from(procRequests).where(eq(procRequests.id, requestId)).limit(1);
    if (!request) return;

    if (result.instanceStatus === 'APPROVED') {
      await tx.update(procRequests).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(procRequests.id, requestId));
      return;
    }

    // REJECTED — input.decision'ın REJECT mi REQUEST_CHANGES mi olduğuna
    // göre talebin kendi durumu ayrışır (motor ikisini de aynı REJECTED
    // instance durumuna indirger, procurement katmanı burada geri ayırır).
    const newStatus = input.decision === 'REQUEST_CHANGES' ? 'REVISION_REQUIRED' : 'REJECTED';
    await tx.update(procRequests).set({ status: newStatus, completedAt: new Date() }).where(eq(procRequests.id, requestId));

    // Reddedilen/değişiklik istenen bir talebin taahhüt ve rezervasyonları
    // serbest bırakılır — resubmit stok/bütçeyi SIFIRDAN kontrol eder, iki
    // kez rezerve edilmiş bir stok kalmasın diye.
    if (request.budgetCommitmentId) {
      await releaseBudgetCommitmentInTx(tx, companyId, request.budgetCommitmentId);
    }
    const lines = await tx.select({ id: procRequestLines.id, reservationId: procRequestLines.reservationId }).from(procRequestLines).where(eq(procRequestLines.requestId, requestId));
    for (const line of lines) {
      if (line.reservationId) {
        await releaseReservationInTx(tx, companyId, line.reservationId);
        // Rezervasyon artık RELEASED — satırın kendi stockStatus/reservedQty/
        // reservationId alanları da PENDING'e döner, aksi halde resubmit
        // ÖNCESİNDE satır hâlâ "rezerve edilmiş" gibi görünür (gerçekte
        // rezervasyon serbest kalmış olsa da) — bu tutarsızlık test
        // sırasında GERÇEKTEN yakalandı, varsayım değil.
        await tx.update(procRequestLines).set({ stockStatus: 'PENDING', reservedQty: null, purchaseQty: null, reservationId: null }).where(eq(procRequestLines.id, line.id));
      }
    }
  });
}
