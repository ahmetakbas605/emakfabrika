import { redirect } from 'next/navigation';

// En ilk scaffold'dan (proje başlangıcı) kalma yer tutucu sayfa — 13 faz
// boyunca hiç düzeltilmemiş, gerçek uygulama hep /login'den başlıyordu.
// Kök adres artık /dashboard'a yönlendiriyor; requireSession zaten
// oturumu olmayan kullanıcıyı /login'e gönderiyor (lib/dal.ts).
export default function Home() {
  redirect('/dashboard');
}
