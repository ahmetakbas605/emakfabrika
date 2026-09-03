// Bir departmanın türüne göre menüsü — TEK KAYNAK.
//
// Daha önce bu tablo dashboard/departments/[departmentId]/layout.tsx'in
// içinde gömülüydü. Departman ana sayfası eklenince (aynı listeyi kart
// olarak göstermesi gerekiyor) iki yerde durması gerekti; kopyalamak
// yerine buraya taşındı. Yeni bir departman türü eklendiğinde YALNIZCA
// bu dosyaya bir satır eklenir.
//
// PDF madde 8, 70: "Muhasebe kullanıcısı için sistem son derece kolay/
// hızlı/bilgi yoğun olmalı, gereksiz animasyon YOK."

import type { IconName } from '@/components/shell/icons';

export interface DepartmentNavItem {
  href: string;
  label: string;
  icon?: IconName;
}

export function departmentNav(departmentId: string, departmentTypeCode: string): DepartmentNavItem[] {
  const base = `/dashboard/departments/${departmentId}`;
  switch (departmentTypeCode) {
    case 'ACCOUNTING':
      return [
        { href: `${base}/accounts`, label: 'Hesap Planı', icon: 'clipboard' },
        { href: `${base}/journals`, label: 'Muhasebe Fişleri', icon: 'scroll' },
        { href: `${base}/kasa`, label: 'Kasa', icon: 'wallet' },
        { href: `${base}/banka`, label: 'Banka', icon: 'landmark' },
        { href: `${base}/checks`, label: 'Çek/Senet', icon: 'scroll' },
        { href: `${base}/cost-centers`, label: 'Masraf Merkezi', icon: 'chart' },
        { href: `${base}/budgets`, label: 'Bütçe', icon: 'chart' },
        { href: `${base}/fixed-assets`, label: 'Demirbaş', icon: 'boxes' },
        { href: `${base}/periods`, label: 'Dönemler', icon: 'calendarClock' },
        { href: `${base}/reports/trial-balance`, label: 'Mizan', icon: 'chart' },
        { href: `${base}/reports/balance-sheet`, label: 'Bilanço', icon: 'chart' },
        { href: `${base}/reports/income-statement`, label: 'Gelir Tablosu', icon: 'chart' }
      ];
    case 'WAREHOUSE':
      return [
        { href: `${base}/warehouses`, label: 'Depolar', icon: 'building' },
        { href: `${base}/stock-items`, label: 'Stok Kartları', icon: 'boxes' },
        { href: `${base}/transfers`, label: 'Transferler', icon: 'truck' },
        { href: `${base}/reservations`, label: 'Rezervasyonlar', icon: 'clipboardCheck' }
      ];
    case 'IT':
      return [
        { href: `${base}/it/dashboard`, label: 'Dashboard', icon: 'dashboard' },
        { href: `${base}/it/assets`, label: 'Varlıklar', icon: 'boxes' },
        { href: `${base}/it/cmdb`, label: 'CMDB', icon: 'gitBranch' },
        { href: `${base}/it/tickets`, label: 'Ticketlar', icon: 'inbox' },
        { href: `${base}/it/field-service`, label: 'Saha İşleri', icon: 'wrench' },
        { href: `${base}/it/maintenance`, label: 'Bakım', icon: 'wrench' },
        { href: `${base}/it/licensing`, label: 'Lisans/Garanti/Sözleşme', icon: 'scroll' },
        { href: `${base}/it/network`, label: 'IPAM/Ağ', icon: 'plug' },
        { href: `${base}/it/network-diagram`, label: 'Ağ Diyagramı', icon: 'gitBranch' },
        { href: `${base}/it/monitoring`, label: 'İzleme', icon: 'activity' },
        { href: `${base}/it/backup`, label: 'Yedekleme', icon: 'archive' },
        { href: `${base}/it/compliance`, label: 'Uyumluluk', icon: 'shield' },
        { href: `${base}/it/credentials`, label: 'Kimlik Kasası', icon: 'key' },
        { href: `${base}/it/servers`, label: 'Sunucu/VM', icon: 'building' },
        { href: `${base}/it/knowledge-base`, label: 'Bilgi Bankası', icon: 'fileSearch' },
        { href: `${base}/it/incidents`, label: 'Incidentlar', icon: 'alert' },
        { href: `${base}/it/problems`, label: 'Problemler', icon: 'fileWarning' },
        { href: `${base}/it/changes`, label: 'Değişiklikler', icon: 'pen' }
      ];
    case 'HR':
      return [
        { href: `${base}/hr/employees`, label: 'Çalışanlar', icon: 'users' },
        { href: `${base}/hr/pdks`, label: 'PDKS', icon: 'calendarClock' },
        { href: `${base}/hr/leave`, label: 'İzin Yönetimi', icon: 'palmtree' },
        { href: `${base}/hr/access`, label: 'Erişim Kontrolü', icon: 'fingerprint' }
      ];
    default:
      return [];
  }
}

// Departman türünün okunabilir adı. Menüsü OLAN türler yukarıda; burada
// listelenenler kullanıcıya "bu departmanın ekranları henüz yok" derken
// tür adını gösterebilmek için.
const TYPE_LABELS: Record<string, string> = {
  ACCOUNTING: 'Muhasebe',
  WAREHOUSE: 'Depo',
  IT: 'Bilgi İşlem',
  HR: 'İnsan Kaynakları'
};

export function departmentTypeLabel(code: string): string {
  return TYPE_LABELS[code] ?? code;
}
