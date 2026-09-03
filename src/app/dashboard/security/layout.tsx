import { SubNav, type SubNavItem } from '@/components/shell/SubNav';

// Görsel Yenileme Faz 2: bu layout ARTIK kendi kabuğunu kurmuyor.
// /dashboard/layout.tsx tüm alt sayfaları zaten DimensionShell ile
// sarıyor; burada ikinci bir kabuk açmak iç içe iki kenar çubuğu
// demekti. Modülün 9 maddelik kendi gezinmesi kaybolmasın diye yatay
// bir şeride taşındı (bkz. components/shell/SubNav.tsx).
//
// requireSession/logout çağrıları da kaldırıldı — ikisini de üstteki
// dashboard layout'u zaten yapıyor, burada tekrarlamak fazladan bir
// oturum sorgusuydu.

const SECURITY_NAV: SubNavItem[] = [
  { href: '/dashboard/security', label: 'Güvenlik Paneli', icon: 'shield' },
  { href: '/dashboard/security/audit', label: 'Audit Trail', icon: 'scroll' },
  { href: '/dashboard/security/events', label: 'Güvenlik Olayları', icon: 'alert' },
  { href: '/dashboard/security/mfa', label: 'MFA (Benim)', icon: 'key' },
  { href: '/dashboard/security/sessions', label: 'Oturumlar / Cihazlar', icon: 'phone' },
  { href: '/dashboard/security/classification', label: 'Veri Sınıflandırma', icon: 'fileSearch' },
  { href: '/dashboard/security/retention', label: 'Saklama / Legal Hold', icon: 'archive' },
  { href: '/dashboard/security/requests', label: 'KVKK Talepleri', icon: 'shieldQuestion' },
  { href: '/dashboard/security/sod', label: 'Görevler Ayrılığı', icon: 'gitBranch' },
  { href: '/dashboard/security/break-glass', label: 'Break-Glass Erişim', icon: 'lock' }
];

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav items={SECURITY_NAV} />
      {children}
    </>
  );
}
