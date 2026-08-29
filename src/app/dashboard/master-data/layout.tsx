import Link from 'next/link';
import { requireFactoryAdmin } from '@/lib/dal';

// Faz 1 (ERP Genişletme) — Master Data hiçbir departmana ait değil (madde
// 189-190: tek kaynak, TÜM departmanların/gelecekteki Satınalma-Satış'ın
// üstüne kurulacağı ortak zemin), bu yüzden requireDepartmentAccess değil
// requireFactoryAdmin ile korunuyor — dashboard/departments/[id]/... yapısının
// DIŞINDA, kendi üst-seviye rotası.
export default async function MasterDataLayout({ children }: { children: React.ReactNode }) {
  await requireFactoryAdmin();

  const links = [
    { href: '/dashboard/master-data/parties', label: 'Cariler' },
    { href: '/dashboard/master-data/products', label: 'Ürünler' },
    { href: '/dashboard/master-data/units', label: 'Birimler' },
    { href: '/dashboard/master-data/currencies', label: 'Para Birimleri' },
    { href: '/dashboard/master-data/payment-terms', label: 'Ödeme Vadeleri' },
    { href: '/dashboard/master-data/price-lists', label: 'Fiyat Listeleri' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 200, borderRight: '1px solid #ddd', padding: '20px 12px' }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Panele Dön</Link>
        <h2 style={{ fontSize: 14, margin: '16px 0 8px', color: '#666' }}>Master Data</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} style={{ display: 'block', padding: '6px 8px', fontSize: 14, textDecoration: 'none', color: '#111', borderRadius: 4 }}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
    </div>
  );
}
