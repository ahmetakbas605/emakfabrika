// Bir departmanın türüne göre menüsü — TEK KAYNAK.
//
// Faz 4: gruplama kullanıcının kendi verdiği "HOLDING ERP MENÜ AĞACI"
// belgesindeki alt birimlere göre yeniden düzenlendi. Grup adları onun
// yazdığı gibi (Donanım/Yazılım, Finans/Vezne/Stok Muhasebe/Genel
// Muhasebe, İK Operasyon/İSG), yorumlanmadan.
//
// İKİ KURAL:
//  1. Hiçbir mevcut ekran DÜŞÜRÜLMEDİ. Ağaçta adı geçmeyen ekranlar
//     (IT'de Dashboard/İzleme/Yedekleme/Uyumluluk) silinmedi, "IT
//     Yönetim" başlığı altında duruyor — menüden çıkarmak onları
//     erişilemez yapardı, ki bu tam da Faz 3'te düzeltilen hataydı.
//  2. Hiçbir OLMAYAN ekran uydurulmadı. Ağaçta olup uygulamada karşılığı
//     bulunmayanlar (İşyeri Hekimi, Garaj, Güvenlik, Odacılar) buraya
//     YAZILMADI — 404 veren bir menü, eksik menüden kötüdür.
//
// PDF madde 8, 70: "Muhasebe kullanıcısı için sistem son derece kolay/
// hızlı/bilgi yoğun olmalı, gereksiz animasyon YOK."

import type { SubNavGroup } from '@/components/shell/SubNav';

export type DepartmentNavGroup = SubNavGroup;

export function departmentNav(departmentId: string, departmentTypeCode: string): DepartmentNavGroup[] {
  const base = `/dashboard/departments/${departmentId}`;

  switch (departmentTypeCode) {
    case 'ACCOUNTING':
      return [
        {
          label: 'Genel Muhasebe',
          items: [
            { href: `${base}/accounts`, label: 'Hesap Planı', icon: 'clipboard' },
            { href: `${base}/journals`, label: 'Muhasebe Fişleri', icon: 'scroll' },
            { href: `${base}/periods`, label: 'Dönem Sonu', icon: 'calendarClock' }
          ]
        },
        {
          label: 'Vezne',
          items: [{ href: `${base}/kasa`, label: 'Kasa', icon: 'wallet' }]
        },
        {
          label: 'Finans',
          items: [
            { href: `${base}/banka`, label: 'Banka', icon: 'landmark' },
            { href: `${base}/checks`, label: 'Çek/Senet', icon: 'scroll' },
            { href: `${base}/budgets`, label: 'Bütçe', icon: 'chart' },
            { href: `${base}/cost-centers`, label: 'Masraf Merkezleri', icon: 'chart' },
            { href: `${base}/reports/trial-balance`, label: 'Mizan', icon: 'chart' },
            { href: `${base}/reports/balance-sheet`, label: 'Bilanço', icon: 'chart' },
            { href: `${base}/reports/income-statement`, label: 'Gelir Tablosu', icon: 'chart' }
          ]
        },
        {
          // Ağaçta Demirbaş "Stok Muhasebe" altında; o alt birim ayrı bir
          // departman TÜRÜ (WAREHOUSE) olarak duruyor, ama /fixed-assets
          // rotası muhasebe departmanının altında. Rotayı taşımak veri
          // modeline dokunmak olurdu — ekran burada, adı ağaçtaki gibi.
          label: 'Stok Muhasebe',
          items: [{ href: `${base}/fixed-assets`, label: 'Demirbaş', icon: 'boxes' }]
        }
      ];

    case 'WAREHOUSE':
      return [
        {
          label: 'Stok Muhasebe',
          items: [
            { href: `${base}/warehouses`, label: 'Depolar', icon: 'building' },
            { href: `${base}/stock-items`, label: 'Stok Kartları', icon: 'boxes' },
            { href: `${base}/transfers`, label: 'Transferler', icon: 'truck' },
            { href: `${base}/reservations`, label: 'Rezervasyonlar', icon: 'clipboardCheck' }
          ]
        }
      ];

    case 'IT':
      return [
        {
          label: 'Donanım',
          items: [
            { href: `${base}/it/assets`, label: 'Varlıklar', icon: 'boxes' },
            { href: `${base}/it/cmdb`, label: 'CMDB', icon: 'gitBranch' },
            { href: `${base}/it/servers`, label: 'Sunucu/VM', icon: 'building' },
            { href: `${base}/it/network`, label: 'IPAM/Ağ', icon: 'plug' },
            { href: `${base}/it/network-diagram`, label: 'Ağ Diyagramı', icon: 'gitBranch' },
            { href: `${base}/it/maintenance`, label: 'Donanım Bakım', icon: 'wrench' },
            { href: `${base}/it/field-service`, label: 'Saha İşleri', icon: 'wrench' }
          ]
        },
        {
          label: 'Yazılım',
          items: [
            { href: `${base}/it/tickets`, label: 'Ticketlar', icon: 'inbox' },
            { href: `${base}/it/licensing`, label: 'Lisans/Garanti/Sözleşme', icon: 'scroll' },
            { href: `${base}/it/credentials`, label: 'Kimlik Kasası', icon: 'key' },
            { href: `${base}/it/knowledge-base`, label: 'Bilgi Bankası', icon: 'fileSearch' },
            { href: `${base}/it/incidents`, label: 'Incidentlar', icon: 'alert' },
            { href: `${base}/it/problems`, label: 'Problemler', icon: 'fileWarning' },
            { href: `${base}/it/changes`, label: 'Değişiklikler', icon: 'pen' }
          ]
        },
        {
          // Ağaçta adı geçmiyordu — düşürmek yerine kendi başlığına alındı.
          label: 'IT Yönetim',
          items: [
            { href: `${base}/it/dashboard`, label: 'Dashboard', icon: 'dashboard' },
            { href: `${base}/it/monitoring`, label: 'İzleme', icon: 'activity' },
            { href: `${base}/it/backup`, label: 'Yedekleme', icon: 'archive' },
            { href: `${base}/it/compliance`, label: 'Uyumluluk', icon: 'shield' }
          ]
        }
      ];

    case 'HR':
      return [
        {
          label: 'İK Operasyon',
          items: [
            { href: `${base}/hr/employees`, label: 'Çalışanlar', icon: 'users' },
            { href: `${base}/hr/pdks`, label: 'PDKS', icon: 'calendarClock' },
            { href: `${base}/hr/leave`, label: 'İzin Yönetimi', icon: 'palmtree' },
            { href: `${base}/hr/access`, label: 'Erişim Kontrolü', icon: 'fingerprint' }
          ]
        },
        {
          // Ağaçta İSG bu birimin altında. Ekran departman-kapsamlı DEĞİL,
          // üst seviye bir rota (/dashboard/safety) — bağlantı olarak
          // buraya kondu, sayfa taşınmadı.
          label: 'İSG',
          items: [{ href: '/dashboard/safety', label: 'İş Sağlığı ve Güvenliği', icon: 'hardHat' }]
        },
        {
          // Ağaçtaki üçüncü alt birim. Ekran YOKTU, bu fazda yazıldı
          // (Muayene / Sağlık Raporu / Periyodik Takip tek sayfada,
          // kayıt türüyle ayrışıyor).
          label: 'İşyeri Hekimi',
          items: [{ href: `${base}/hr/occupational-health`, label: 'Muayene & Sağlık Raporları', icon: 'activity' }]
        }
      ];

    case 'PROCUREMENT':
      // Kullanıcının isteğiyle Satınalma bir DEPARTMAN oldu. Ekranlar
      // taşınmadı — /dashboard/procurement/* rotalarında duruyorlar ve
      // buradan bağlanıyorlar. İSG'de kurulan AYNI desen: rotayı taşımak
      // 9 klasörü ve içlerindeki tüm bağlantıları kırardı, kazancı ise
      // yalnızca adres çubuğundaki metin olurdu.
      return [
        {
          label: 'Talep & Teklif',
          items: [
            { href: '/dashboard/procurement', label: 'Satınalma Talepleri', icon: 'cart' },
            { href: '/dashboard/procurement/rfqs', label: 'Teklif Toplama (RFQ)', icon: 'clipboardCheck' },
            { href: '/dashboard/procurement/tenders', label: 'İhaleler', icon: 'scale' }
          ]
        },
        {
          label: 'Satınalma Yönetim',
          items: [
            { href: '/dashboard/procurement/dashboard', label: 'Satınalma Panosu', icon: 'chart' },
            { href: '/dashboard/procurement/scoring-weights', label: 'Değerlendirme Ağırlıkları', icon: 'gauge' }
          ]
        }
        // Kazanan Kararları / Satınalma Siparişleri / Tedarikçi Faturaları
        // BİLİNÇLİ OLARAK YOK: awards/, purchase-orders/ ve
        // vendor-invoices/ klasörlerinde LİSTE sayfası yok, yalnızca
        // detay rotaları ([awardId] vb.). Liste adresine gidildiğinde
        // istek kardeş dinamik rotaya ([requestId]) düşüyor ve
        // "Talep bulunamadı" ile 500 veriyor — canlı sunucuda görüldü.
        // Bu ekranlara RFQ/İhale akışının içinden geçiliyor. Liste
        // sayfaları yazılırsa buraya eklenmeli.
      ];

    case 'MARKETING':
      // Pazarlama — Faz 0: mevcut satış hattı buraya bağlandı, ekranlar
      // TAŞINMADI (/dashboard/sales/* rotalarında duruyor). Satınalma ve
      // İSG'de kurulan AYNI desen.
      //
      // Anlaşmalar / Kantar / Ofis-Mağaza grupları sonraki fazlarda
      // eklenecek — ekranları henüz YAZILMADI, o yüzden menüye de
      // konmadı (404 veren menü, eksik menüden kötüdür).
      return [
        {
          label: 'Satış Süreci',
          items: [
            { href: '/dashboard/sales', label: 'Pazarlama Panosu', icon: 'landmark' },
            { href: '/dashboard/sales/leads', label: 'Aday Müşteriler', icon: 'users' },
            { href: '/dashboard/sales/opportunities', label: 'Fırsatlar', icon: 'chart' },
            { href: '/dashboard/sales/quotes', label: 'Teklifler', icon: 'clipboard' },
            { href: '/dashboard/sales/orders', label: 'Siparişler', icon: 'cart' }
          ]
        },
        {
          label: 'Faturalama & Takip',
          items: [
            { href: '/dashboard/sales/invoices', label: 'Faturalar', icon: 'scroll' },
            { href: '/dashboard/sales/complaints', label: 'Şikâyetler', icon: 'alert' }
          ]
        },
        {
          // Faz 1 — sözleşme departmana bağlı (kantar/mağaza ile AYNI
          // sebep), rota departman altında.
          label: 'Anlaşmalar',
          items: [{ href: `${base}/marketing/contracts`, label: 'Sözleşmeler', icon: 'scroll' }]
        },
        {
          // Faz 2 — kantar departmana bağlı, o yüzden rota departman
          // altında (satış ekranlarının aksine, onlar üst seviyede).
          label: 'Kantar',
          items: [{ href: `${base}/marketing/weighbridge`, label: 'Tartım & Gerçekleşme', icon: 'gauge' }]
        },
        {
          // Faz 3 — mağaza da departmana bağlı, AYNI sebep.
          label: 'Ofis / Mağaza',
          items: [{ href: `${base}/marketing/stores`, label: 'Mağazalar', icon: 'building' }]
        }
      ];

    default:
      return [];
  }
}

// Departman türünün okunabilir adı — kullanıcının ağacındaki birim
// adlarıyla hizalı.
const TYPE_LABELS: Record<string, string> = {
  ACCOUNTING: 'Muhasebe & Finans',
  WAREHOUSE: 'Stok Muhasebe',
  IT: 'Bilgi Sistemleri',
  HR: 'İnsan Kaynakları',
  PROCUREMENT: 'Satınalma',
  MARKETING: 'Pazarlama'
};

export function departmentTypeLabel(code: string): string {
  return TYPE_LABELS[code] ?? code;
}
