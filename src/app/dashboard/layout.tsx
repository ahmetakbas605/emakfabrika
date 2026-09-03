import { requireSession } from '@/lib/dal';
import { logout } from '@/actions/auth';
import { DimensionShell, type NavGroup } from '@/components/shell/DimensionShell';

// ==================================================================
// Görsel Yenileme Faz 2 — TÜM MENÜLER.
//
// Faz 1'de tasarım sistemi ve kabuk kurulmuştu ama yalnızca 2 sayfaya
// bağlanmıştı; kalan 123 sayfa kabuksuz, beyaz zeminde açılıyordu.
// Bu dosya o boşluğu tek noktadan kapatıyor: /dashboard altındaki HER
// sayfa artık aynı kabuğu, aynı menüyü ve aynı görsel dili alıyor.
//
// Etiketler UYDURULMADI — her modülün kendi sayfasındaki <h1> metninden
// alındı (ör. "MES (Üretim Yürütme Sistemi)" -> "MES"), böylece menüdeki
// ad ile sayfadaki başlık birbirini tutuyor.
//
// MENÜ FİLTRELENMİYOR: bugün de dashboard ana sayfasındaki hızlı erişim
// bağlantıları herkese TÜM modülleri gösteriyor ve erişim kontrolü
// sayfaların KENDİSİNDE (requireDepartmentAccess) yapılıyor. Menüyü
// kendi uydurduğum bir departman eşlemesiyle filtrelemek, kullanıcının
// gerçekten yetkili olduğu bir modülü YANLIŞLIKLA gizleme riski taşırdı
// — bu projede erişim modeli departman bazlı ve eşleme tek yerde
// tanımlı değil. Gizlemek yerine göstermek, yanlış tarafa hata yapmak
// demek: yetkisiz kullanıcı sayfaya girince zaten /dashboard'a döner.
//
// Menüde OLMAYAN üç klasör bilinçli: departments/ yalnızca
// [departmentId] içeriyor (liste sayfası yok, link 404 olurdu), hr/ ve
// workflow/ ise index'siz — onlar alt sayfalarıyla listelendi.
// ==================================================================

const NAV: NavGroup[] = [
  {
    label: 'Genel',
    items: [
      { href: '/dashboard', label: 'Panel', icon: 'dashboard' },
      { href: '/dashboard/approvals', label: 'Onay Kutusu', icon: 'inbox' },
      { href: '/dashboard/bi', label: 'Yönetim Panosu', icon: 'chart' }
    ]
  },
  {
    label: 'Üretim',
    items: [
      { href: '/dashboard/production', label: 'Üretim', icon: 'factory' },
      { href: '/dashboard/mes', label: 'MES', icon: 'gauge' },
      { href: '/dashboard/mrp', label: 'MRP', icon: 'boxes' },
      { href: '/dashboard/quality', label: 'Kalite', icon: 'clipboardCheck' }
    ]
  },
  {
    label: 'Tedarik & Satış',
    items: [
      { href: '/dashboard/procurement', label: 'Satınalma', icon: 'cart' },
      { href: '/dashboard/sales', label: 'Satış & CRM', icon: 'landmark' },
      { href: '/dashboard/master-data', label: 'Ana Veri', icon: 'clipboard' }
    ]
  },
  {
    label: 'Bakım & Varlık',
    items: [
      { href: '/dashboard/eam', label: 'Bakım (EAM)', icon: 'wrench' },
      { href: '/dashboard/fleet', label: 'Filo', icon: 'truck' },
      { href: '/dashboard/projects', label: 'Projeler', icon: 'briefcase' }
    ]
  },
  {
    label: 'İnsan Kaynakları',
    items: [
      { href: '/dashboard/hr/leave', label: 'İzin Talepleri', icon: 'palmtree' },
      { href: '/dashboard/hr/overtime', label: 'Fazla Mesai', icon: 'calendarClock' },
      { href: '/dashboard/org', label: 'Organizasyon', icon: 'users' }
    ]
  },
  {
    label: 'Uyum & Risk',
    items: [
      { href: '/dashboard/safety', label: 'İSG', icon: 'hardHat' },
      { href: '/dashboard/environment', label: 'Çevre', icon: 'leaf' },
      { href: '/dashboard/legal', label: 'Hukuk', icon: 'scale' },
      { href: '/dashboard/rnd', label: 'Ar-Ge', icon: 'flask' }
    ]
  },
  {
    label: 'Finans & Sistem',
    items: [
      { href: '/dashboard/treasury', label: 'Hazine', icon: 'wallet' },
      { href: '/dashboard/holding', label: 'Holding', icon: 'building' },
      { href: '/dashboard/integration', label: 'Entegrasyon', icon: 'plug' },
      { href: '/dashboard/workflow/rules', label: 'İş Akışı', icon: 'workflow' },
      { href: '/dashboard/security', label: 'Core Security', icon: 'shield' }
    ]
  }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <DimensionShell
      navGroups={NAV}
      brand="emakfabrika"
      brandHref="/dashboard"
      companyName={session.companyName}
      userName={session.fullName}
      logoutAction={logout}
    >
      {children}
    </DimensionShell>
  );
}
