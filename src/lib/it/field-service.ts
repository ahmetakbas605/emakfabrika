import 'server-only';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  serviceDeskTickets, workOrders, technicianLocations, itPolicies,
  checklistTemplates, checklistTemplateItems, workOrderChecklists, workOrderChecklistItems,
  workOrderParts, stockItems, stockMovements, users
} from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';
import { recordStockMovement } from '@/lib/warehouse';
import { money } from '@/lib/money';

// FIELD-SERVICE.md §1 — work order, FIELD_SERVICE tipi bir ticket'ın 1:1
// saha-özel eki. Durum makinesinin KENDİSİ lib/it/tickets.ts'te, burada
// tekrarlanmaz.
export async function createWorkOrder(companyId: string, ticketId: string): Promise<string> {
  const [ticket] = await db.select({ id: serviceDeskTickets.id, ticketType: serviceDeskTickets.ticketType }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId))).limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');
  if (ticket.ticketType !== 'FIELD_SERVICE') throw new ItError('Yalnızca saha (FIELD_SERVICE) tipi ticket için work order açılabilir.');

  const [existing] = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.ticketId, ticketId)).limit(1);
  if (existing) throw new ItError('Bu ticket için zaten bir work order var.');

  const id = newId();
  await db.insert(workOrders).values({ id, companyId, ticketId });
  return id;
}

// FIELD_SERVICE tipi ama henüz work order açılmamış ticket'lar — "Work
// Order Oluştur" formunun dropdown'ı bunları listeler.
export async function listUnstartedFieldServiceTickets(companyId: string) {
  return db
    .select({ id: serviceDeskTickets.id, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title })
    .from(serviceDeskTickets)
    .leftJoin(workOrders, eq(workOrders.ticketId, serviceDeskTickets.id))
    .where(and(eq(serviceDeskTickets.companyId, companyId), eq(serviceDeskTickets.ticketType, 'FIELD_SERVICE'), isNull(workOrders.id)));
}

export async function listWorkOrders(companyId: string) {
  return db
    .select({
      id: workOrders.id, ticketId: workOrders.ticketId, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title,
      status: serviceDeskTickets.status, arrivedAt: workOrders.arrivedAt, customerName: workOrders.customerName, createdAt: workOrders.createdAt
    })
    .from(workOrders)
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId))
    .where(eq(workOrders.companyId, companyId))
    .orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrder(companyId: string, workOrderId: string) {
  const [row] = await db
    .select({
      id: workOrders.id, ticketId: workOrders.ticketId, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title,
      status: serviceDeskTickets.status, arrivedAt: workOrders.arrivedAt, arrivalLatitude: workOrders.arrivalLatitude,
      arrivalLongitude: workOrders.arrivalLongitude, customerName: workOrders.customerName, signatureNote: workOrders.signatureNote,
      createdAt: workOrders.createdAt
    })
    .from(workOrders)
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId))
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.companyId, companyId)))
    .limit(1);
  if (!row) throw new ItError('Work order bulunamadı.');
  return row;
}

// FIELD-SERVICE.md §2 — KVKK/madde 88,132: konum takibi varsayılan KAPALI.
// ARRIVAL_BUTTON her zaman tek noktalık bir kayıt olarak izinlidir;
// CONTINUOUS yalnızca it_policies AÇIKSA kabul edilir.
export async function recordTechnicianLocation(companyId: string, userId: string, workOrderId: string | null, latitude: number, longitude: number, source: 'ARRIVAL_BUTTON' | 'CONTINUOUS'): Promise<void> {
  if (source === 'CONTINUOUS') {
    const [policy] = await db.select().from(itPolicies).where(eq(itPolicies.companyId, companyId)).limit(1);
    if (!policy?.continuousLocationTrackingEnabled) throw new ItError('Sürekli konum takibi bu şirket için açık değil.');
  }
  await db.insert(technicianLocations).values({ id: newId(), userId, workOrderId, latitude: String(latitude), longitude: String(longitude), source });
}

export async function markArrived(companyId: string, workOrderId: string, userId: string, latitude: number, longitude: number): Promise<void> {
  const [wo] = await db.select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.id, workOrderId), eq(workOrders.companyId, companyId))).limit(1);
  if (!wo) throw new ItError('Work order bulunamadı.');

  await db.transaction(async (tx) => {
    await tx.update(workOrders).set({ arrivedAt: new Date(), arrivalLatitude: String(latitude), arrivalLongitude: String(longitude) }).where(eq(workOrders.id, workOrderId));
    await tx.insert(technicianLocations).values({ id: newId(), userId, workOrderId, latitude: String(latitude), longitude: String(longitude), source: 'ARRIVAL_BUTTON' });
  });
}

export async function getItPolicies(companyId: string) {
  const [row] = await db.select().from(itPolicies).where(eq(itPolicies.companyId, companyId)).limit(1);
  return row ?? { companyId, continuousLocationTrackingEnabled: false };
}

export async function setContinuousLocationTracking(companyId: string, enabled: boolean): Promise<void> {
  await db.insert(itPolicies).values({ companyId, continuousLocationTrackingEnabled: enabled }).onDuplicateKeyUpdate({ set: { continuousLocationTrackingEnabled: enabled } });
}

export async function recordSignature(companyId: string, workOrderId: string, customerName: string, signatureNote: string): Promise<void> {
  const result = await db.update(workOrders).set({ customerName, signatureNote }).where(and(eq(workOrders.id, workOrderId), eq(workOrders.companyId, companyId)));
  if (result[0].affectedRows === 0) throw new ItError('Work order bulunamadı.');
}

// --- Checklist (FIELD-SERVICE.md §3) ---

export interface CreateChecklistTemplateInput {
  code: string;
  name: string;
  items: string[];
}

export async function createChecklistTemplate(companyId: string, input: CreateChecklistTemplateInput): Promise<string> {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(checklistTemplates).values({ id, companyId, code: input.code, name: input.name });
    if (input.items.length > 0) {
      await tx.insert(checklistTemplateItems).values(input.items.map((label, i) => ({ id: newId(), templateId: id, label, orderIndex: i })));
    }
  });
  return id;
}

export async function listChecklistTemplates(companyId: string) {
  return db.select().from(checklistTemplates).where(eq(checklistTemplates.companyId, companyId));
}

export async function listChecklistTemplateItems(templateId: string) {
  return db.select().from(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, templateId)).orderBy(asc(checklistTemplateItems.orderIndex));
}

// §3 — şablon SATIRLARI bir KEZ kopyalanır, template SONRADAN değişse bile
// bu work order'ın checklist'i sabit kalır.
export async function attachChecklistToWorkOrder(workOrderId: string, templateId: string | null): Promise<string> {
  const [existing] = await db.select({ id: workOrderChecklists.id }).from(workOrderChecklists).where(eq(workOrderChecklists.workOrderId, workOrderId)).limit(1);
  if (existing) throw new ItError('Bu work order için zaten bir checklist var.');

  return db.transaction(async (tx) => {
    const checklistId = newId();
    await tx.insert(workOrderChecklists).values({ id: checklistId, workOrderId, templateId });

    if (templateId) {
      const templateItems = await tx.select().from(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, templateId)).orderBy(asc(checklistTemplateItems.orderIndex));
      if (templateItems.length > 0) {
        await tx.insert(workOrderChecklistItems).values(templateItems.map((t) => ({ id: newId(), checklistId, label: t.label, orderIndex: t.orderIndex })));
      }
    }
    return checklistId;
  });
}

export async function addChecklistItem(checklistId: string, label: string, orderIndex: number): Promise<void> {
  await db.insert(workOrderChecklistItems).values({ id: newId(), checklistId, label, orderIndex });
}

export async function getWorkOrderChecklist(workOrderId: string) {
  const [checklist] = await db.select().from(workOrderChecklists).where(eq(workOrderChecklists.workOrderId, workOrderId)).limit(1);
  if (!checklist) return null;
  const items = await db.select().from(workOrderChecklistItems).where(eq(workOrderChecklistItems.checklistId, checklist.id)).orderBy(asc(workOrderChecklistItems.orderIndex));
  return { checklist, items };
}

export async function toggleChecklistItem(itemId: string, checked: boolean, checkedBy: string, note?: string): Promise<void> {
  await db.update(workOrderChecklistItems).set({ checked, note, checkedAt: checked ? new Date() : null, checkedBy: checked ? checkedBy : null }).where(eq(workOrderChecklistItems.id, itemId));
}

// --- Parça tüketimi (FIELD-SERVICE.md §4) ---
// IT-ARCHITECTURE.md §9 Risk 1'in çözümü: Depo'nun GERÇEK stock_items/
// stock_movements'ı kullanılıyor, ayrı bir "spare_parts" sayacı YOK.

export interface ConsumePartInput {
  workOrderId: string;
  warehouseId: string;
  stockItemId: string;
  quantity: number | string;
  billable?: boolean;
  consumedByUserId: string;
}

export async function consumePart(companyId: string, input: ConsumePartInput): Promise<string> {
  const [wo] = await db.select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.id, input.workOrderId), eq(workOrders.companyId, companyId))).limit(1);
  if (!wo) throw new ItError('Work order bulunamadı.');

  const movement = await recordStockMovement({
    companyId,
    warehouseId: input.warehouseId,
    stockItemId: input.stockItemId,
    movementType: 'OUT',
    quantity: input.quantity,
    description: `Saha işi malzeme tüketimi — work order ${input.workOrderId}`,
    transactionDate: new Date().toISOString().slice(0, 10),
    sourceType: 'WORK_ORDER_PART',
    sourceId: input.workOrderId,
    createdByUserId: input.consumedByUserId
  });

  // unitCost, tüketim ANINDAKİ ortalama maliyetin SNAPSHOT'ı — stock_movements
  // zaten bu maliyeti kaydetti, buradan okunuyor (aynı bilgiyi iki yerde
  // farklı hesaplamamak için).
  const [stockMovementRow] = await db.select({ unitCost: stockMovements.unitCost }).from(stockMovements).where(eq(stockMovements.id, movement.movementId)).limit(1);
  const unitCost = stockMovementRow?.unitCost ?? '0';

  const id = newId();
  await db.insert(workOrderParts).values({
    id, workOrderId: input.workOrderId, stockItemId: input.stockItemId, stockMovementId: movement.movementId,
    quantity: String(money(input.quantity)), unitCost, billable: input.billable ?? false, consumedByUserId: input.consumedByUserId
  });
  return id;
}

export async function listWorkOrderParts(workOrderId: string) {
  return db
    .select({ id: workOrderParts.id, sku: stockItems.sku, name: stockItems.name, quantity: workOrderParts.quantity, unitCost: workOrderParts.unitCost, billable: workOrderParts.billable, consumedAt: workOrderParts.consumedAt, consumedByName: users.fullName })
    .from(workOrderParts)
    .innerJoin(stockItems, eq(stockItems.id, workOrderParts.stockItemId))
    .innerJoin(users, eq(users.id, workOrderParts.consumedByUserId))
    .where(eq(workOrderParts.workOrderId, workOrderId))
    .orderBy(desc(workOrderParts.consumedAt));
}
