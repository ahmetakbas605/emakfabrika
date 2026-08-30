import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listProductionOrders } from '@/lib/production/orders';
import { listBoms } from '@/lib/production/bom';

const LINKS = [
  { href: '/dashboard/production/orders', label: 'Üretim Emirleri' },
  { href: '/dashboard/production/bom', label: 'BOM (Ürün Ağacı)' },
  { href: '/dashboard/production/routing', label: 'Routing (Rota)' },
  { href: '/dashboard/production/workcenters', label: 'İş Merkezleri' }
];

export default async function ProductionHomePage() {
  const session = await requireSession();
  const [orders, boms] = await Promise.all([listProductionOrders(session.companyId), listBoms(session.companyId)]);
  const activeOrders = orders.filter((o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS').length;
  const pendingApproval = orders.filter((o) => o.status === 'SUBMITTED').length;
  const activeBoms = boms.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Üretim</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>BOM → Routing → Üretim Emri → İş Emri → Malzeme Çıkışı → Üretim → Mamul (Holding ERP Faz 2).</p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Devam Eden Üretim Emri" value={activeOrders} />
        <Stat label="Onay Bekleyen" value={pendingApproval} />
        <Stat label="Toplam Üretim Emri" value={orders.length} />
        <Stat label="Güncel BOM" value={activeBoms} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {LINKS.map((l) => <Link key={l.href} href={l.href} style={{ fontSize: 14 }}>{l.label} →</Link>)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}
