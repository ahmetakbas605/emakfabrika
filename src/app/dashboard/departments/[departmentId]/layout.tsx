import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';

// PDF madde 8, 70: "Muhasebe kullanıcısı için sistem son derece kolay/hızlı/
// bilgi yoğun olmalı, gereksiz animasyon YOK." Departman türüne göre menü
// bugün yalnızca ACCOUNTING için var — başka bir departman türü PDF'i
// geldiğinde bu layout'a yeni bir menü seti eklenecek (bkz. ARCHITECTURE.md §6).
export default async function DepartmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { access } = await requireDepartmentAccess(departmentId);

  const nav =
    access.departmentTypeCode === 'ACCOUNTING'
      ? [
          { href: `/dashboard/departments/${departmentId}/accounts`, label: 'Hesap Planı' },
          { href: `/dashboard/departments/${departmentId}/journals`, label: 'Muhasebe Fişleri' },
          { href: `/dashboard/departments/${departmentId}/kasa`, label: 'Kasa' },
          { href: `/dashboard/departments/${departmentId}/banka`, label: 'Banka' },
          { href: `/dashboard/departments/${departmentId}/checks`, label: 'Çek/Senet' },
          { href: `/dashboard/departments/${departmentId}/periods`, label: 'Dönemler' },
          { href: `/dashboard/departments/${departmentId}/reports/trial-balance`, label: 'Mizan' },
          { href: `/dashboard/departments/${departmentId}/reports/balance-sheet`, label: 'Bilanço' },
          { href: `/dashboard/departments/${departmentId}/reports/income-statement`, label: 'Gelir Tablosu' }
        ]
      : [];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0.75rem 2rem', borderBottom: '1px solid #ddd' }}>
        <Link href="/dashboard" style={{ fontWeight: 700, textDecoration: 'none', color: '#111' }}>emakfabrika</Link>
        <span style={{ color: '#666' }}>{access.departmentName} — {access.roleName}</span>
        <nav style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: '#333', fontSize: 14 }}>{item.label}</Link>
          ))}
        </nav>
      </header>
      <main style={{ padding: '1.5rem 2rem' }}>{children}</main>
    </div>
  );
}
