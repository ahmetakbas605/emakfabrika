import type { Instrumentation } from 'next';

// TODO: SCHEDULER_INFRASTRUCTURE — kullanıcının kararı: fabrikanın kendi
// sunucusunda 7/24 çalışan bir Node süreci garantisi var, bu yüzden HARİCİ
// bir cron/OS zamanlayıcı yerine bu sürecin KENDİ İÇİNDE bir zamanlayıcı
// (bkz. lib/scheduler.ts). Next.js'in register() kancası, sunucu her
// başladığında (dev VE prod, tek seferlik) çağrılır — SLA eskalasyonu
// (SERVICE-DESK.md §8) ve bakım otomatik üretimi (MAINTENANCE.md §2) burada
// başlar. Edge runtime'da çalıştırılmaz (mysql2 Node API'lerine ihtiyaç
// duyar) — yalnızca nodejs runtime'da başlatılır.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}

// Faz 20 (Production Hardening) — harici bir hata izleme servisi (Sentry
// vb.) YOK, TODO: ERROR_MONITORING_PROVIDER (üretim dağıtımı netleşmeden
// tahmin edilmeyecek) — bu, o servis bağlanana kadar en azından
// YAPILANDIRILMIŞ (structured) bir hata kaydı sağlar: yol/yöntem/hata
// mesajı, ASLA istek gövdesi/başlıkları (şifre, token gibi hassas veri
// içerebilir — IT-SECURITY.md §1'in "sır loglama" karşıtı ilkesiyle AYNI
// disiplin, yalnızca network_credentials için değil, genel olarak).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined;
  console.error('[request-error]', JSON.stringify({ path: request.path, method: request.method, routeType: context.routeType, message, digest }));
};
