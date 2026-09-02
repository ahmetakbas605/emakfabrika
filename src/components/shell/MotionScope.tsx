'use client';

import { usePathname } from 'next/navigation';
import { resolveMotionTier } from '@/lib/motion';

// Görsel Yenileme Faz 0 — hareket bütçesini (lib/motion.ts) DOM'a bağlayan
// tek nokta. Kademe rotadan türediği için hiçbir sayfanın kendi kademesini
// bilmesi/beyan etmesi GEREKMEZ — yeni bir modül eklendiğinde otomatik
// olarak doğru davranır.
//
// KRİTİK: `display: contents` — bu sarmalayıcı DOM'da vardır (CSS öznitelik
// seçicileri `[data-motion="..."] ...` çalışsın diye) ama LAYOUT'A HİÇ
// KATILMAZ. Mevcut 126 düz sayfanın ızgarası/dolgusu bu yüzden ZERRE
// KADAR değişmez — bu, "çalışan sistemi bozma" kuralının bu değişiklikteki
// karşılığı: hareket altyapısı canlı, görünüm ise Stitch'in tasarımı
// gelene kadar OLDUĞU GİBİ kalıyor.
//
// key={pathname}: CSS giriş animasyonunun her gezinmede yeniden
// tetiklenmesi için gereken tek şey. Aynı rota içinde (server action
// sonrası revalidate) pathname DEĞİŞMEDİĞİ için yeniden kurulum OLMAZ —
// form doldururken ekranın "zıplaması" bu sayede imkânsız.
export function MotionScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tier = resolveMotionTier(pathname);

  return (
    <div data-motion={tier} data-motion-page key={pathname} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
