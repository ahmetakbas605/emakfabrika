import Link from 'next/link';
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
        { href: `${base}/stock-items`, label: 'Stok Kartları' }
      ];
    case 'IT':
      return [
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
        { href: `${base}/it/incidents`, label: 'Incidentlar' },
        { href: `${base}/it/problems`, label: 'Problemler' },
        { href: `${base}/it/changes`, label: 'Değişiklikler' }
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
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0.75rem 2rem', borderBottom: '1px solid #ddd' }}>
        <Link href="/dashboard" style={{ fontWeight: 700, textDecoration: 'none', color: '#111' }}>emakfabrika</Link>
        <span style={{ color: '#666' }}>{access.departmentName} — {access.roleName}</span>
        <nav style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: '#333', fontSize: 14 }}>{item.label}</Link>
          ))}
        </nav>
      </header>
      <main style={{ padding: '1.5rem 2rem' }}>{children}</main>
    </div>
  );
}
