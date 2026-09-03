import { requireSession } from '@/lib/dal';
import { logout } from '@/actions/auth';
import { DimensionShell, type NavGroup } from '@/components/shell/DimensionShell';
import { listCompanyDepartments } from '@/lib/departments';
import { listUserDepartmentAccess } from '@/lib/permissions';
import { departmentNav } from '@/lib/department-nav';
import type { IconName } from '@/components/shell/icons';

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
//
// Faz 5 (kullanıcının kendi talebi, birebir): "departman demek ayrı bir
// şirket değil, bu departmanlar menü başlığı oluyor altındaki sayfalarda
// alt menüleri oluyor, departman demek çalışan o birimin içerisindeki
// menüyü görür demek." Faz 3'e kadar "Departmanlar & Birimler" grubu TEK
// bir statik bağlantıydı (/dashboard/departments listesine gidip oradan
// tıklamak gerekiyordu) ve o liste sayfası zaten "fabrika/holding
// yöneticisi HEPSİNİ, herkes YALNIZCA kendisine atanmışı görür" kuralını
// uyguluyordu (lib/departments.ts:listCompanyDepartments /
// lib/permissions.ts:listUserDepartmentAccess) — ama bu kural yan
// menüye hiç yansımıyordu. Artık AYNI iki fonksiyondan üretilen her
// departman, kendi adıyla BİR menü grubu (başlık) ve altında
// department-nav.ts'teki gerçek sayfaları (alt menü) olarak doğrudan
// kenar çubuğunda görünüyor — bkz. aşağıdaki buildDepartmentNavGroups.
// Bu, dosyanın en üstündeki "MENÜ FİLTRELENMİYOR" kararının İSTİSNASI
// DEĞİL, tam tersi: o karar departman-DIŞI modüller için hâlâ geçerli
// (eşleme merkezi tek yerde tanımlı değil, riskli); departman menüsü
// zaten merkezi tek kaynaktan (department-nav.ts + yukarıdaki iki liste
// fonksiyonu) geldiği için burada filtrelemek güvenli VE doğru.
// ==================================================================

// Bir departmanı kenar çubuğunda TEK bir grup (başlık = departmanın kendi
// adı) olarak gösterir. department-nav.ts departmanı kendi İÇİNDE alt
// başlıklara ayırıyor (ör. IT -> Donanım/Yazılım/IT Yönetim) — kenar
// çubuğu tek seviye açılım desteklediği için (SubNav'daki gibi ikinci bir
// iç başlık YOK) bu alt başlıklar burada tek listede birleştiriliyor;
// department-nav.ts'in KENDİSİ değişmedi, departman ana sayfası
// (departments/[id]/page.tsx) ve SubNav şeridi hâlâ o iç gruplamayı
// aynen gösteriyor.
function buildDepartmentNavGroup(departmentId: string, departmentTypeCode: string, departmentName: string): NavGroup {
  const base = `/dashboard/departments/${departmentId}`;
  const subGroups = departmentNav(departmentId, departmentTypeCode);
  return {
    label: departmentName,
    items: [
      { href: base, label: 'Genel Bakış', icon: 'building' as IconName },
      ...subGroups.flatMap((group) => group.items.map((item) => ({ href: item.href, label: item.label, icon: (item.icon ?? 'building') as IconName })))
    ]
  };
}

// --- 1-2. GENEL & ÇALIŞAN PORTALI + OPERASYONEL MODÜLLER ---
// Bu iki grup departman-DIŞI: herkese açık (requireSession yeterli) ortak
// araçlar (İzin/Onay Kutusu) ve şirket-geneli operasyonel modüller
// (Üretim/MES/Kalite/... requireDepartmentAccess DEĞİL, requireSession
// kullanıyor — bkz. dosya başındaki "MENÜ FİLTRELENMİYOR" kararı, bu
// gruplar için hâlâ geçerli).
const NAV_BEFORE_DEPARTMENTS: NavGroup[] = [
  {
    label: 'Genel & Çalışan Portalı',
    items: [
      { href: '/dashboard', label: 'Panel', icon: 'dashboard' },
      { href: '/dashboard/approvals', label: 'Onay Kutusu', icon: 'inbox' },
      { href: '/dashboard/hr/leave', label: 'İzin Taleplerim', icon: 'palmtree' },
      { href: '/dashboard/hr/overtime', label: 'Fazla Mesai Talepleri', icon: 'calendarClock' }
    ]
  },
  {
    // Satınalma ve Talep/Teklif Yönetimi buradan ÇIKARILDI: kullanıcının
    // isteğiyle Satınalma artık bir DEPARTMAN (departman türü
    // PROCUREMENT, bkz. lib/department-nav.ts). Ekranları
    // Departmanlar > Satınalma altında, kendi alt başlıklarıyla.
    // Burada yalnızca planlama kaldı — MRP bir üretim planlama aracı,
    // satınalma birimine ait değil.
    label: 'Planlama',
    items: [
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
  }
];

// --- 4. HOLDING YÖNETİMİ, UYUM & CORE SECURITY ---
// Departman gruplarından SONRA gelir (bkz. DashboardLayout) — holding
// konsolidasyonu, tanım gereği tüm departmanların ÜSTÜNDE bir katman.
const NAV_AFTER_DEPARTMENTS: NavGroup[] = [
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

  // Faz 5 — AYNI iki kaynak, departments/page.tsx ile BİREBİR aynı kural
  // (bilinçli olarak kopyalanmadı, oradaki yorum da aynı şeyi söylüyor):
  // fabrika/holding yöneticisi şirketin TÜM departmanlarını, diğer
  // herkes YALNIZCA kendisine atanmış departmanları görür.
  const seesAllDepartments = session.isFactoryAdmin || session.isHoldingAdmin;
  const departmentEntries = seesAllDepartments
    ? (await listCompanyDepartments(session.companyId)).map((d) => ({ id: d.id, typeCode: d.departmentTypeCode, name: d.name }))
    : (await listUserDepartmentAccess(session.id)).map((a) => ({ id: a.departmentId, typeCode: a.departmentTypeCode, name: a.departmentName }));

  const departmentNavGroups = departmentEntries.map((d) => buildDepartmentNavGroup(d.id, d.typeCode, d.name));

  const navGroups: NavGroup[] = [
    ...NAV_BEFORE_DEPARTMENTS,
    // Departmanı olmayan (henüz hiçbir birime atanmamış) bir kullanıcı
    // için bile bu genel liste sayfası kalsın diye ayrı tutuluyor — kart
    // görünümü + rol adı, tek tek departman gruplarının vermediği bir
    // özet sağlıyor.
    { label: 'Departmanlar & Birimler', items: [{ href: '/dashboard/departments', label: 'Tüm Departmanlar', icon: 'building' }] },
    ...departmentNavGroups,
    ...NAV_AFTER_DEPARTMENTS
  ];

  return (
    <DimensionShell
      navGroups={navGroups}
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
