import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { subscribe } from './events';
import { resolveEmailProvider } from './notifications';

// Bu dosya, Event Bus'ın GERÇEKTEN uçtan uca çalıştığını kanıtlayan tek
// somut abone kümesi (Faz 13'ün "yalnızca soyut bir altyapı değil, en az
// bir gerçek tüketicisi olsun" kararı). "Kime bildirilsin" için AYRI bir
// bildirim-tercihi/ayar tablosu İCAT EDİLMEDİ (bilinçli kapsam kararı,
// TODO: NOTIFICATION_RECIPIENT_CONFIG) — bugün basitçe şirketin fabrika
// yöneticilerine gider. Gönderim NullEmailProvider üzerinden GEÇECEĞİ
// için (gerçek sağlayıcı yapılandırılana kadar) her çağrı hata fırlatır
// — bu hata `dispatchEvent`'in try/catch'i tarafından yakalanır, olayı
// tetikleyen GERÇEK iş kaydı (İSG olayı/NCR) HİÇBİR ZAMAN etkilenmez.
async function notifyFactoryAdmins(companyId: string, subject: string, body: string): Promise<void> {
  const admins = await db.select({ email: users.email }).from(users).where(and(eq(users.companyId, companyId), eq(users.isFactoryAdmin, true)));
  const provider = resolveEmailProvider(companyId);
  for (const admin of admins) {
    await provider.send({ to: admin.email, subject, body });
  }
}

const SAFETY_HIGH_SEVERITIES = new Set(['SEVERE', 'FATAL']);
subscribe('SAFETY_INCIDENT_CREATED', async (companyId, entityId, payload) => {
  const severity = payload?.severity as string | undefined;
  if (!severity || !SAFETY_HIGH_SEVERITIES.has(severity)) return;
  await notifyFactoryAdmins(companyId, `Ciddi İSG Olayı — ${severity}`, `Yeni bir ${severity} seviyeli İSG olayı kaydedildi (${entityId}). Detaylar için sisteme giriş yapın.`);
});

const NCR_HIGH_SEVERITIES = new Set(['CRITICAL', 'MAJOR']);
subscribe('QUALITY_NCR_CREATED', async (companyId, entityId, payload) => {
  const severity = payload?.severity as string | undefined;
  if (!severity || !NCR_HIGH_SEVERITIES.has(severity)) return;
  await notifyFactoryAdmins(companyId, `Kritik Uygunsuzluk (NCR) — ${severity}`, `Yeni bir ${severity} seviyeli NCR kaydedildi (${entityId}). Detaylar için sisteme giriş yapın.`);
});
