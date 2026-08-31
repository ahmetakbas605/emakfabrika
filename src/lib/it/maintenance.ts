import 'server-only';
import { eq, and, lte, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import type { Tx } from '@/db/client';
import {
  maintenancePlans, maintenanceWorkOrders, workOrders, serviceDeskTickets, itAssets, users, eamAssets, vehicles
} from '@/db/schema';
import { newId } from '@/lib/id';
import { createTicketInTx } from '@/lib/it/tickets';
import { changeAssetStatus } from '@/lib/it/assets';
import { changeEamAssetStatus } from '@/lib/eam/assets';
import { changeVehicleStatus } from '@/lib/fleet/vehicles';
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
  // Holding ERP Faz 6 (EAM) — assetId (IT) İLE AYNI anlamda ama fabrika
  // ekipmanı/bina için. İkisi BİRDEN doldurulabilir teknik olarak ama
  // gerçek kullanımda ya biri ya diğeri (çağıran taraf hangi UI'dan
  // geldiğine göre yalnızca kendi alanını doldurur).
  eamAssetId?: string;
  // Holding ERP Faz 7 (Filo) — assetId/eamAssetId İLE AYNI desende üçüncü
  // opsiyonel varlık türü.
  vehicleId?: string;
  departmentId?: string;
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
    id, companyId, assetId: input.assetId, eamAssetId: input.eamAssetId, vehicleId: input.vehicleId, departmentId: input.departmentId, title: input.title, maintenanceType: input.maintenanceType,
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
      active: maintenancePlans.active, assetTag: itAssets.assetTag, eamAssetCode: eamAssets.code, plateNo: vehicles.plateNo, assignedTechnicianName: users.fullName
    })
    .from(maintenancePlans)
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .leftJoin(eamAssets, eq(eamAssets.id, maintenancePlans.eamAssetId))
    .leftJoin(vehicles, eq(vehicles.id, maintenancePlans.vehicleId))
    .leftJoin(users, eq(users.id, maintenancePlans.assignedTechnicianId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(maintenancePlans.nextDueDate);
}

// Holding ERP Faz 6 (EAM) — yalnızca eamAssetId dolu olan planları listeler
// (EAM'in kendi sayfasında "Bakım Planlarım" görünümü için; IT'nin kendi
// sayfası zaten TÜM planları görüyor, filtrelemeye ihtiyacı yok).
export async function listEamMaintenancePlans(companyId: string) {
  return db
    .select({
      id: maintenancePlans.id, title: maintenancePlans.title, maintenanceType: maintenancePlans.maintenanceType,
      frequency: maintenancePlans.frequency, intervalValue: maintenancePlans.intervalValue, nextDueDate: maintenancePlans.nextDueDate,
      active: maintenancePlans.active, eamAssetCode: eamAssets.code, eamAssetName: eamAssets.name
    })
    .from(maintenancePlans)
    .innerJoin(eamAssets, eq(eamAssets.id, maintenancePlans.eamAssetId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(maintenancePlans.nextDueDate);
}

// Holding ERP Faz 7 (Filo) — listEamMaintenancePlans İLE AYNI desen,
// yalnızca vehicleId dolu olan planlar.
export async function listFleetMaintenancePlans(companyId: string) {
  return db
    .select({
      id: maintenancePlans.id, title: maintenancePlans.title, maintenanceType: maintenancePlans.maintenanceType,
      frequency: maintenancePlans.frequency, intervalValue: maintenancePlans.intervalValue, nextDueDate: maintenancePlans.nextDueDate,
      active: maintenancePlans.active, plateNo: vehicles.plateNo
    })
    .from(maintenancePlans)
    .innerJoin(vehicles, eq(vehicles.id, maintenancePlans.vehicleId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(maintenancePlans.nextDueDate);
}

async function generateOneWorkOrder(tx: Tx, companyId: string, fallbackDepartmentId: string, plan: typeof maintenancePlans.$inferSelect, scheduledDate: string, triggeredByUserId: string): Promise<void> {
  // UNIQUE(maintenance_plan_id, scheduled_date) — bu iş İKİ KEZ çalıştırılsa
  // bile aynı gün için ikinci bir satır YAZILAMAZ, MySQL kendisi reddeder.
  const [already] = await tx.select({ id: maintenanceWorkOrders.id }).from(maintenanceWorkOrders).where(and(eq(maintenanceWorkOrders.maintenancePlanId, plan.id), eq(maintenanceWorkOrders.scheduledDate, scheduledDate))).limit(1);
  if (already) return;

  // Holding ERP Faz 6 — plan KENDİ departmanını taşıyorsa (EAM planları,
  // ör. "Bakım") o kullanılır; boşsa (mevcut TÜM IT planları) çağıranın
  // verdiği departmana düşer — GERİYE UYUMLU, davranış değişmedi.
  const departmentId = plan.departmentId ?? fallbackDepartmentId;

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
// ilerletir. TODO: SCHEDULER_INFRASTRUCTURE ÇÖZÜLDÜ — lib/scheduler.ts'in
// periyodik döngüsü bu fonksiyonu her şirket için otomatik çağırır
// (src/instrumentation.ts:register() ile sunucu başlarken kurulur). Bu
// fonksiyonun kendisi hâlâ companyId/departmentId/triggeredByUserId alan,
// zamanlayıcıdan bağımsız, saf bir fonksiyon — hem otomatik döngü hem de
// maintenance sayfasındaki elle "Bugün İçin Bakım İşlerini Oluştur" butonu
// AYNI kod yolunu kullanır, davranış farkı yok.
//
// Holding ERP Faz 6 — TEK çağrı hem IT hem EAM planlarını KAPSAR: her plan
// KENDİ departmanını (varsa) kullanır, yalnızca departmanı BOŞ olan planlar
// (bugüne kadarki TÜM IT planları) burada verilen fallbackDepartmentId'ye
// düşer — lib/scheduler.ts hâlâ TEK bir çağrı yapıyor (IT departmanını
// fallback olarak), EAM'in kendi "Bugün İçin Oluştur" butonu da AYNI
// fonksiyonu, kendi (herhangi bir) fallback'iyle çağırabilir; ikisi de
// TÜM şirketin due planlarını işler, yalnızca fallback farklı bir sonuç
// vermez çünkü gerçek EAM planlarının KENDİ departmanı zaten dolu.
export async function runDueMaintenanceGeneration(companyId: string, fallbackDepartmentId: string, triggeredByUserId: string): Promise<GenerationResult> {
  const today = new Date().toISOString().slice(0, 10);
  const duePlans = await db.select().from(maintenancePlans).where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.active, true), lte(maintenancePlans.nextDueDate, today)));

  let generatedCount = 0;
  for (const plan of duePlans) {
    await db.transaction(async (tx) => {
      await generateOneWorkOrder(tx, companyId, fallbackDepartmentId, plan, plan.nextDueDate, triggeredByUserId);
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
      ticketNo: serviceDeskTickets.ticketNo, ticketStatus: serviceDeskTickets.status, assetTag: itAssets.assetTag, eamAssetCode: eamAssets.code, plateNo: vehicles.plateNo
    })
    .from(maintenanceWorkOrders)
    .innerJoin(maintenancePlans, eq(maintenancePlans.id, maintenanceWorkOrders.maintenancePlanId))
    .innerJoin(workOrders, eq(workOrders.id, maintenanceWorkOrders.workOrderId))
    .innerJoin(serviceDeskTickets, eq(serviceDeskTickets.id, workOrders.ticketId))
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .leftJoin(eamAssets, eq(eamAssets.id, maintenancePlans.eamAssetId))
    .leftJoin(vehicles, eq(vehicles.id, maintenancePlans.vehicleId))
    .where(eq(maintenancePlans.companyId, companyId))
    .orderBy(desc(maintenanceWorkOrders.scheduledDate));
}

// MAINTENANCE.md §4 — bakım işi CLOSED olduğunda, bağlı varlık (varsa)
// UNDER_MAINTENANCE'tan IN_SERVICE'e OTOMATİK döner, it_asset_status_
// history'e yazılır. lib/it/tickets.ts:transitionTicket'ın CLOSED dalından
// çağrılır (tickets.ts, work_orders/maintenance şemasını okuyabilir ama asıl
// asset-durumu bilgisi burada, tek sorumluluk maintenance modülünde kalsın
// diye).
//
// Holding ERP Faz 6 — plan ya itAssets'e (assetId) ya eamAssets'e
// (eamAssetId) bağlı olabilir, İKİSİ AYNI ANDA DEĞİL; hangisi doluysa O
// varlık geri döndürülür. EAM tarafı changeEamAssetStatus kullanır (kendi
// geçmiş tablosu yok, madde eam_assets tanımının kendi yorumunda kayıtlı).
export async function revertAssetAfterMaintenanceIfApplicable(companyId: string, ticketId: string, changedBy: string): Promise<void> {
  const [row] = await db
    .select({
      assetId: maintenancePlans.assetId, assetStatus: itAssets.status, eamAssetId: maintenancePlans.eamAssetId, eamAssetStatus: eamAssets.status,
      vehicleId: maintenancePlans.vehicleId, vehicleStatus: vehicles.status
    })
    .from(workOrders)
    .innerJoin(maintenanceWorkOrders, eq(maintenanceWorkOrders.workOrderId, workOrders.id))
    .innerJoin(maintenancePlans, eq(maintenancePlans.id, maintenanceWorkOrders.maintenancePlanId))
    .leftJoin(itAssets, eq(itAssets.id, maintenancePlans.assetId))
    .leftJoin(eamAssets, eq(eamAssets.id, maintenancePlans.eamAssetId))
    .leftJoin(vehicles, eq(vehicles.id, maintenancePlans.vehicleId))
    .where(eq(workOrders.ticketId, ticketId))
    .limit(1);

  if (!row) return;
  if (row.assetId && row.assetStatus === 'UNDER_MAINTENANCE') {
    await changeAssetStatus(companyId, row.assetId, 'IN_SERVICE', changedBy, 'Bakım işi tamamlandı, otomatik geri dönüş.');
    return;
  }
  if (row.eamAssetId && row.eamAssetStatus === 'UNDER_MAINTENANCE') {
    await changeEamAssetStatus(companyId, row.eamAssetId, 'IN_SERVICE');
    return;
  }
  if (row.vehicleId && row.vehicleStatus === 'UNDER_MAINTENANCE') {
    await changeVehicleStatus(companyId, row.vehicleId, 'ACTIVE');
  }
}

