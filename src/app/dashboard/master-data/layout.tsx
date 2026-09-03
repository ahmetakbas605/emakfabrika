import { requireFactoryAdmin } from '@/lib/dal';
import { SubNav, type SubNavItem } from '@/components/shell/SubNav';

// Faz 1 (ERP Genişletme) — Master Data hiçbir departmana ait değil (madde
// 189-190: tek kaynak, TÜM departmanların/gelecekteki Satınalma-Satış'ın
// üstüne kurulacağı ortak zemin), bu yüzden requireDepartmentAccess değil
// requireFactoryAdmin ile korunuyor — dashboard/departments/[id]/... yapısının
// DIŞINDA, kendi üst-seviye rotası.
//
// Görsel Yenileme Faz 2: bu layout'un kendi 200px'lik dikey kenar çubuğu
// vardı. /dashboard/layout.tsx artık her sayfayı DimensionShell ile
// sardığı için o çubuk ekranda İKİNCİ bir dikey menü sütunu oluyordu.
// Menü kaybolmadan yatay şeride taşındı (bkz. components/shell/SubNav.tsx)
// — Core Security'de yapılanın aynısı. `← Panele Dön` bağlantısı da
// kaldırıldı: ana menü zaten her sayfada görünür durumda.

const MASTER_DATA_NAV: SubNavItem[] = [
  { href: '/dashboard/master-data/parties', label: 'Cariler', icon: 'users' },
  { href: '/dashboard/master-data/products', label: 'Ürünler', icon: 'boxes' },
  { href: '/dashboard/master-data/units', label: 'Birimler', icon: 'clipboard' },
  { href: '/dashboard/master-data/currencies', label: 'Para Birimleri', icon: 'wallet' },
  { href: '/dashboard/master-data/payment-terms', label: 'Ödeme Vadeleri', icon: 'calendarClock' },
  { href: '/dashboard/master-data/price-lists', label: 'Fiyat Listeleri', icon: 'scroll' }
];

export default async function MasterDataLayout({ children }: { children: React.ReactNode }) {
  await requireFactoryAdmin();

  return (
    <>
      <SubNav items={MASTER_DATA_NAV} />
      {children}
    </>
  );
}
