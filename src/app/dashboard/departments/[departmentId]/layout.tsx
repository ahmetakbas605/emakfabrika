import { SubNav } from '@/components/shell/SubNav';
import { requireDepartmentAccess } from '@/lib/dal';

// PDF madde 8, 70: "Muhasebe kullanıcısı için sistem son derece kolay/hızlı/
// bilgi yoğun olmalı, gereksiz animasyon YOK." Departman türüne göre menü —
// yeni bir departman türü eklendiğinde NAV_BY_DEPARTMENT_TYPE'a bir satır
// eklenir, geri kalan layout değişmez.
function navFor(departmentId: string, departmentTypeCode: string): { href: string; label: string }[] {
  const base = `/dashboard/departments/${departmentId}`;
  switch (departmentTypeCode) {
    case 'ACCOUNTING':
      return [
        { href: `${base}/accounts`, label: 'Hesap Planı' },
        { href: `${base}/journals`, label: 'Muhasebe Fişleri' },
        { href: `${base}/kasa`, label: 'Kasa' },
        { href: `${base}/banka`, label: 'Banka' },
        { href: `${base}/checks`, label: 'Çek/Senet' },
        { href: `${base}/cost-centers`, label: 'Masraf Merkezi' },
        { href: `${base}/budgets`, label: 'Bütçe' },
        { href: `${base}/fixed-assets`, label: 'Demirbaş' },
        { href: `${base}/periods`, label: 'Dönemler' },
        { href: `${base}/reports/trial-balance`, label: 'Mizan' },
        { href: `${base}/reports/balance-sheet`, label: 'Bilanço' },
        { href: `${base}/reports/income-statement`, label: 'Gelir Tablosu' }
      ];
    case 'WAREHOUSE':
      return [
        { href: `${base}/warehouses`, label: 'Depolar' },
        { href: `${base}/stock-items`, label: 'Stok Kartları' },
        { href: `${base}/transfers`, label: 'Transferler' },
        { href: `${base}/reservations`, label: 'Rezervasyonlar' }
      ];
    case 'IT':
      return [
        { href: `${base}/it/dashboard`, label: 'Dashboard' },
        { href: `${base}/it/assets`, label: 'Varlıklar' },
        { href: `${base}/it/cmdb`, label: 'CMDB' },
        { href: `${base}/it/tickets`, label: 'Ticketlar' },
        { href: `${base}/it/field-service`, label: 'Saha İşleri' },
        { href: `${base}/it/maintenance`, label: 'Bakım' },
        { href: `${base}/it/licensing`, label: 'Lisans/Garanti/Sözleşme' },
        { href: `${base}/it/network`, label: 'IPAM/Ağ' },
        { href: `${base}/it/network-diagram`, label: 'Ağ Diyagramı' },
        { href: `${base}/it/monitoring`, label: 'İzleme' },
        { href: `${base}/it/backup`, label: 'Yedekleme' },
        { href: `${base}/it/compliance`, label: 'Uyumluluk' },
        { href: `${base}/it/credentials`, label: 'Kimlik Kasası' },
        { href: `${base}/it/servers`, label: 'Sunucu/VM' },
        { href: `${base}/it/knowledge-base`, label: 'Bilgi Bankası' },
        { href: `${base}/it/incidents`, label: 'Incidentlar' },
        { href: `${base}/it/problems`, label: 'Problemler' },
        { href: `${base}/it/changes`, label: 'Değişiklikler' }
      ];
    case 'HR':
      return [
        { href: `${base}/hr/employees`, label: 'Çalışanlar' },
        { href: `${base}/hr/pdks`, label: 'PDKS' },
        { href: `${base}/hr/leave`, label: 'İzin Yönetimi' },
        { href: `${base}/hr/access`, label: 'Erişim Kontrolü' }
      ];
    default:
      return [];
  }
}

export default async function DepartmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { access } = await requireDepartmentAccess(departmentId);
  const nav = navFor(departmentId, access.departmentTypeCode);

  return (
    <>
      {/* Görsel Yenileme Faz 2: buradaki kendi başlık çubuğu kaldırıldı.
          /dashboard/layout.tsx artık her sayfaya markayı ve ana menüyü
          zaten koyuyordu — ikinci bir "emakfabrika" bağlantısı ve ikinci
          bir üst çubuk tekrardı. Kalan bilgi (hangi departman, hangi rol)
          değerli olduğu için bağlam satırı olarak korundu.
          `fontFamily: system-ui` override'ı da kaldırıldı; Dimension'ın
          kendi yazı tiplerini eziyordu. */}
      <div className="mb-6">
        <span className="dim-metric" style={{ color: 'var(--dim-sunset)' }}>{access.departmentName}</span>
        <span className="dim-technical ml-3" style={{ color: 'var(--dim-slate)' }}>{access.roleName}</span>
      </div>

      {nav.length > 0 ? <SubNav items={nav.map((item) => ({ href: item.href, label: item.label }))} /> : null}

      {children}
    </>
  );
}
