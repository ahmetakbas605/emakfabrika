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
