import 'server-only';
import { eq, and, lte, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import type { Tx } from '@/db/client';
import {
  maintenancePlans, maintenanceWorkOrders, workOrders, serviceDeskTickets, itAssets, users
} from '@/db/schema';
import { newId } from '@/lib/id';
import { createTicketInTx } from '@/lib/it/tickets';
import { changeAssetStatus } from '@/lib/it/assets';
import { attachChecklistToWorkOrderInTx } from '@/lib/it/field-service';

// MAINTENANCE.md §2 — frequency+interval'a göre next_due_date'i İLERLETİR.
// Takvim ayı/yıl aritmetiği JS Date'in kendi taşıma davranışına bırakılıyor
// (ör. 31 Ocak + 1 ay -> 3 Mart YERİNE JS bunu 28/29 Şubat'a düzeltmez,
// taşırır) — TODO: MAINTENANCE_MONTH_END_EDGE_CASE, ay sonu tarihli planlar
// için ayrı bir netleştirme gerektirir, PDF bu kenar durumu için net değil.
export function addInterval(date: Date, frequency: (typeof maintenancePlans.$inferInsert)['frequency'], intervalValue: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'DAILY': d.setDate(d.getDate() + intervalValue); break;
    case 'WEEKLY': d.setDate(d.getDate() + intervalValue * 7); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + intervalValue); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + intervalValue * 3); break;
    case 'ANNUAL': d.setFullYear(d.getFullYear() + intervalValue); break;
  }
  return d;
}

export interface CreateMaintenancePlanInput {
  assetId?: string;
  title: string;
  maintenanceType: (typeof maintenancePlans.$inferInsert)['maintenanceType'];
  frequency: (typeof maintenancePlans.$inferInsert)['frequency'];
  intervalValue?: number;
  startDate: string;
  assignedTechnicianId?: string;
  checklistTemplateId?: string;
  estimatedDurationMinutes?: number;
}

export async function createMaintenancePlan(companyId: string, input: CreateMaintenancePlanInput): Promise<string> {
  const id = newId();
  await db.insert(maintenancePlans).values({
    id, companyId, assetId: input.assetId, title: input.title, maintenanceType: input.maintenanceType,
    frequency: input.frequency, intervalValue: input.intervalValue ?? 1, startDate: input.startDate,
    nextDueDate: input.startDate, assignedTechnicianId: input.assignedTechnicianId,
    checklistTemplateId: input.checklistTemplateId, estimatedDurationMinutes: input.estimatedDurationMinutes
  });
  return id;
}

export async function listMaintenancePlans(companyId: string) {
  return db
    .select({
      id: maintenancePlans.id, title: maintenancePlans.title, maintenanceType: maintenancePlans.maintenanceType,
      frequency: maintenancePlans.frequency, intervalValue: maintenancePlans.intervalValue, nextDueDate: maintenancePlans.nextDueDate,
      active: maintenancePlans.active, assetTag: itAssets.assetTag, assignedTechnicianName: users.fullName
    })
    .from(maintenancePlans)
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .leftJoin(users, eq(users.id, maintenancePlans.assignedTechnicianId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(maintenancePlans.nextDueDate);
}

async function generateOneWorkOrder(tx: Tx, companyId: string, departmentId: string, plan: typeof maintenancePlans.$inferSelect, scheduledDate: string, triggeredByUserId: string): Promise<void> {
  // UNIQUE(maintenance_plan_id, scheduled_date) — bu iş İKİ KEZ çalıştırılsa
  // bile aynı gün için ikinci bir satır YAZILAMAZ, MySQL kendisi reddeder.
  const [already] = await tx.select({ id: maintenanceWorkOrders.id }).from(maintenanceWorkOrders).where(and(eq(maintenanceWorkOrders.maintenancePlanId, plan.id), eq(maintenanceWorkOrders.scheduledDate, scheduledDate))).limit(1);
  if (already) return;

  // requestedByUserId ZORUNLU bir kolon (NOT NULL) — plan.assignedTechnicianId
  // boş olabileceğinden (§1, PDF'in kendi "FK NULL"ü), üretimi TETİKLEYEN
  // kullanıcı "talep eden" olarak kullanılıyor. Gerçek bir scheduler
  // bağlandığında bu, sabit bir "sistem kullanıcısı" olacak — bugün elle
  // tetiklendiği için oturum sahibi kullanıcı yeterince doğru bir karşılık.
  const ticketId = await createTicketInTx(tx, companyId, departmentId, {
    title: `[Bakım] ${plan.title}`,
    description: `Otomatik oluşturulan bakım işi — ${plan.maintenanceType}, plan: ${plan.id}.`,
    priority: 'NORMAL',
    ticketType: 'FIELD_SERVICE',
    requestedByUserId: triggeredByUserId,
    relatedAssetId: plan.assetId ?? undefined
  });

  const workOrderId = newId();
  await tx.insert(workOrders).values({ id: workOrderId, companyId, ticketId });
  await tx.insert(maintenanceWorkOrders).values({ id: newId(), maintenancePlanId: plan.id, workOrderId, scheduledDate });

  if (plan.checklistTemplateId) {
    await attachChecklistToWorkOrderInTx(tx, workOrderId, plan.checklistTemplateId);
  }
}

export interface GenerationResult {
  generatedCount: number;
}

// MAINTENANCE.md §2 — bugün için VADESİ GELMİŞ (next_due_date <= today) tüm
// planlar için work order üretir, next_due_date'i bir sonraki periyoda
// ilerletir. Bir scheduler'a bağlanmadı (TODO: SCHEDULER_INFRASTRUCTURE,
// SERVICE-DESK.md §8'in aynı gerekçesi) — bugün yalnızca ELLE (bir buton
// veya bu fonksiyonu çağıran bir API ucu üzerinden) tetiklenir. Mantığın
// KENDİSİ zaten idempotent (UNIQUE kısıtı), gerçek bir cron BAĞLANDIĞINDA
// bu fonksiyonun KENDİSİ değişmeden kullanılabilir.
export async function runDueMaintenanceGeneration(companyId: string, departmentId: string, triggeredByUserId: string): Promise<GenerationResult> {
  const today = new Date().toISOString().slice(0, 10);
  const duePlans = await db.select().from(maintenancePlans).where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.active, true), lte(maintenancePlans.nextDueDate, today)));

  let generatedCount = 0;
  for (const plan of duePlans) {
    await db.transaction(async (tx) => {
      await generateOneWorkOrder(tx, companyId, departmentId, plan, plan.nextDueDate, triggeredByUserId);
      const nextDue = addInterval(new Date(plan.nextDueDate), plan.frequency, plan.intervalValue);
      await tx.update(maintenancePlans).set({ nextDueDate: nextDue.toISOString().slice(0, 10) }).where(eq(maintenancePlans.id, plan.id));
    });
    generatedCount++;
  }
  return { generatedCount };
}

export async function listMaintenanceWorkOrders(companyId: string) {
  return db
    .select({
      id: maintenanceWorkOrders.id, workOrderId: maintenanceWorkOrders.workOrderId, planTitle: maintenancePlans.title,
      scheduledDate: maintenanceWorkOrders.scheduledDate, generatedAt: maintenanceWorkOrders.generatedAt,
      ticketNo: serviceDeskTickets.ticketNo, ticketStatus: serviceDeskTickets.status, assetTag: itAssets.assetTag
    })
    .from(maintenanceWorkOrders)
    .innerJoin(maintenancePlans, eq(maintenancePlans.id, maintenanceWorkOrders.maintenancePlanId))
    .innerJoin(workOrders, eq(workOrders.id, maintenanceWorkOrders.workOrderId))
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId))
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(desc(maintenanceWorkOrders.scheduledDate));
}

// MAINTENANCE.md §4 — bakım işi CLOSED olduğunda, bağlı varlık (varsa)
// UNDER_MAINTENANCE'tan IN_SERVICE'e OTOMATİK döner, it_asset_status_
// history'e yazılır. lib/it/tickets.ts:transitionTicket'ın CLOSED dalından
// çağrılır (tickets.ts, work_orders/maintenance şemasını okuyabilir ama asıl
// asset-durumu bilgisi burada, tek sorumluluk maintenance modülünde kalsın
// diye).
export async function revertAssetAfterMaintenanceIfApplicable(companyId: string, ticketId: string, changedBy: string): Promise<void> {
  const [row] = await db
    .select({ assetId: maintenancePlans.assetId, assetStatus: itAssets.status })
    .from(workOrders)
    .innerJoin(maintenanceWorkOrders, eq(maintenanceWorkOrders.workOrderId, workOrders.id))
    .innerJoin(maintenancePlans, eq(maintenancePlans.id, maintenanceWorkOrders.maintenancePlanId))
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .where(eq(workOrders.ticketId, ticketId))
    .limit(1);

  if (!row?.assetId) return;
  if (row.assetStatus !== 'UNDER_MAINTENANCE') return;
  await changeAssetStatus(companyId, row.assetId, 'IN_SERVICE', changedBy, 'Bakım işi tamamlandı, otomatik geri dönüş.');
}

