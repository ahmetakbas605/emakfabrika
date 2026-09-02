import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { integrationEvents } from '@/db/schema';
import { newId } from '@/lib/id';

// Holding ERP Faz 13 (Integration Hub + Event Bus) — TEK fabrika süreci,
// dağıtık bir sistem YOK, bu yüzden gerçek bir mesaj kuyruğu/broker
// (Kafka/RabbitMQ) BİLİNÇLİ OLARAK KURULMADI (projenin kendi "spekülatif
// altyapı yok" ilkesi). Bu, İÇİ-SÜREÇ (in-process) senkron bir
// publish/subscribe kaydı + KALICI bir olay günlüğü — "Hub" burada her
// modülün ürettiği olayların TEK bir yerde toplandığı ve entegrasyonların
// (bildirim/webhook/dış sistem) buna abone olabileceği merkez anlamına
// geliyor.
//
// lib/accounting.ts:postJournal/postJournalInTx İLE AYNI "iç mantık dışa,
// tx parametre olarak alan fonksiyona taşınır" deseni: olay günlüğü
// satırı, çağıranın KENDİ transaction'ı içinde ATOMİK yazılmalı (bir olay
// asla, onu tetikleyen iş kaydı rollback olduğunda DB'de yetim kalmamalı)
// — bu yüzden `publishEventInTx` var. Ama abonelere bildirim (network I/O
// olabilir) ASLA bir DB transaction'ı İÇİNDE yapılmaz — `publishEvent`
// (transaction dışı çağıranlar için) commit'ten SONRA `dispatchEvent`'i
// ayrıca çağırır; transaction İÇİNDE olan çağıranlar (ör. createIncident)
// kendi `tx.commit`'i sonrasında `dispatchEvent`'i AYRICA çağırmalı.
export type EventHandler = (companyId: string, entityId: string | null, payload: Record<string, unknown> | undefined) => Promise<void>;

const subscribers = new Map<string, EventHandler[]>();

// Bir abone (subscriber) SADECE process yeniden başlatıldığında
// kaybolur — bu proje için sorun değil (kalıcı durum DB'de, abonelik
// kaydı yalnızca "kim dinliyor" bilgisi, process her başladığında
// lib/integration/subscribers.ts YENİDEN kayıt olur).
export function subscribe(eventType: string, handler: EventHandler): void {
  const list = subscribers.get(eventType) ?? [];
  list.push(handler);
  subscribers.set(eventType, list);
}

export interface PublishEventInput {
  eventType: string;
  sourceModule: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

export async function publishEventInTx(tx: Tx, companyId: string, input: PublishEventInput): Promise<string> {
  const id = newId();
  await tx.insert(integrationEvents).values({ id, companyId, eventType: input.eventType, sourceModule: input.sourceModule, entityId: input.entityId, payload: input.payload });
  return id;
}

export async function publishEvent(companyId: string, input: PublishEventInput): Promise<string> {
  const id = await db.transaction((tx) => publishEventInTx(tx, companyId, input));
  await dispatchEvent(companyId, input.eventType, input.entityId ?? null, input.payload);
  return id;
}

// Bir abone hata fırlatırsa bu ASLA onu tetikleyen iş akışını (ör. bir
// İSG olayı kaydı oluşturma) bozmaz — yalnızca loglanır. Bildirim
// altyapısının (bugün Null sağlayıcılar, TODO: NOTIFICATION_PROVIDER_
// CREDENTIALS_REQUIRED) yapılandırılmamış olması, GERÇEK iş verisinin
// kaydedilmesini ASLA engellememeli.
export async function dispatchEvent(companyId: string, eventType: string, entityId: string | null, payload?: Record<string, unknown>): Promise<void> {
  const handlers = subscribers.get(eventType) ?? [];
  for (const handler of handlers) {
    try {
      await handler(companyId, entityId, payload);
    } catch (err) {
      console.error(`[integration-events] '${eventType}' aboneliği başarısız oldu (ana iş akışı ETKİLENMEDİ):`, err);
    }
  }
}

export async function listEvents(companyId: string, eventType?: string) {
  const conditions = eventType ? and(eq(integrationEvents.companyId, companyId), eq(integrationEvents.eventType, eventType)) : eq(integrationEvents.companyId, companyId);
  return db.select().from(integrationEvents).where(conditions).orderBy(desc(integrationEvents.createdAt)).limit(200);
}
