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
// Faz 4: menü AĞACI kullanıcının kendi verdiği "HOLDING ERP MENÜ AĞACI"
// belgesine göre yeniden kuruldu — grup adları ve sıralama onun yazdığı
// gibi, yorumlanmadan. Yalnızca GERÇEKTEN VAR OLAN rotalar bağlandı;
// ağaçta olup uygulamada karşılığı olmayanlar (Lojistik & Sevkiyat,
// İdari İşler/Garaj/Güvenlik/Odacılar, İşyeri Hekimi) menüye YAZILMADI —
// 404 veren bir menü öğesi, eksik bir menü öğesinden daha kötüdür.
//
// Faz 3: departments/ ARTIK menüde. Eskiden liste sayfası da departman
// ana sayfası da yoktu (link 404 veriyordu); ikisi de eklendi, çünkü o
// ağaç bir birimin işinin TAMAMI (Muhasebe/Depo/IT/İK, 47 sayfa).
// Menüde hâlâ olmayan hr/ ve workflow/ index'siz — alt sayfalarıyla
// listelendiler.
// ==================================================================

const NAV: NavGroup[] = [
  // --- 1. GENEL & ÇALIŞAN PORTALI ---
  {
    label: 'Genel & Çalışan Portalı',
    items: [
      { href: '/dashboard', label: 'Panel', icon: 'dashboard' },
      { href: '/dashboard/approvals', label: 'Onay Kutusu', icon: 'inbox' },
      { href: '/dashboard/hr/leave', label: 'İzin Taleplerim', icon: 'palmtree' },
      { href: '/dashboard/hr/overtime', label: 'Fazla Mesai Talepleri', icon: 'calendarClock' }
    ]
  },

  // --- 2. OPERASYONEL SÜREÇLER & MODÜLLER ---
  // Ağaçtaki ikinci seviye (Pazarlama & Lojistik, Satınalma & Planlama...)
  // burada GRUP BAŞLIĞI oldu; kenar çubuğu tek seviye açılım destekliyor
  // ve üç seviye iç içe menü, günde yüzlerce kez gezilen bir ERP'de
  // tıklama maliyetini artırırdı.
  {
    label: 'Pazarlama & Lojistik',
    items: [
      { href: '/dashboard/sales', label: 'Pazarlama & CRM', icon: 'landmark' }
    ]
  },
  {
    label: 'Satınalma & Planlama',
    items: [
      { href: '/dashboard/procurement', label: 'Satınalma', icon: 'cart' },
      { href: '/dashboard/procurement/rfqs', label: 'Talep ve Teklif Yönetimi', icon: 'clipboardCheck' },
      { href: '/dashboard/mrp', label: 'Üretim & Operasyon Planlama', icon: 'boxes' }
    ]
  },
  {
    label: 'İşletme, Üretim & Varlık',
    items: [
      { href: '/dashboard/production', label: 'Üretim', icon: 'factory' },
      { href: '/dashboard/mes', label: 'MES', icon: 'gauge' },
      { href: '/dashboard/quality', label: 'Kalite Kontrol', icon: 'clipboardCheck' },
      { href: '/dashboard/eam', label: 'Bakım (EAM)', icon: 'wrench' },
      { href: '/dashboard/fleet', label: 'Filo Yönetimi', icon: 'truck' },
      { href: '/dashboard/projects', label: 'Proje Yönetimi', icon: 'briefcase' }
    ]
  },
  {
    label: 'Ana Veri Yönetimi',
    items: [
      { href: '/dashboard/master-data/parties', label: 'Cariler', icon: 'users' },
      { href: '/dashboard/master-data/products', label: 'Ürünler & Malzeme', icon: 'boxes' },
      { href: '/dashboard/master-data/units', label: 'Birimler & Para Birimleri', icon: 'clipboard' },
      { href: '/dashboard/master-data/payment-terms', label: 'Vadeler & Fiyat Listeleri', icon: 'wallet' }
    ]
  },

  // --- 3. DEPARTMANLAR VE BİRİMLER ---
  // Ağacın bu dalı tek bir giriş kapısı: birim seçilince o birimin kendi
  // ekranları açılıyor (bkz. lib/department-nav.ts).
  {
    label: 'Departmanlar & Birimler',
    items: [
      { href: '/dashboard/departments', label: 'Departmanlar', icon: 'building' }
    ]
  },

  // --- 4. HOLDING YÖNETİMİ, UYUM & CORE SECURITY ---
  {
    label: 'Holding Yönetimi',
    items: [
      { href: '/dashboard/bi', label: 'Yönetim Panosu', icon: 'chart' },
      { href: '/dashboard/holding', label: 'Holding Konsolidasyonu', icon: 'building' },
      { href: '/dashboard/treasury', label: 'Hazine & Finansal Risk', icon: 'wallet' },
      { href: '/dashboard/workflow/rules', label: 'İş Akışı', icon: 'workflow' },
      { href: '/dashboard/integration', label: 'Entegrasyon Yönetimi', icon: 'plug' }
    ]
  },
  {
    label: 'Uyum & Risk',
    items: [
      { href: '/dashboard/environment', label: 'Çevre', icon: 'leaf' },
      { href: '/dashboard/legal', label: 'Hukuk', icon: 'scale' },
      { href: '/dashboard/rnd', label: 'Ar-Ge', icon: 'flask' },
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
