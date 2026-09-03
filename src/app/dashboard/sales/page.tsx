import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listLeads } from '@/lib/sales/leads';
import { listOpportunities } from '@/lib/sales/opportunities';
import { listQuotes } from '@/lib/sales/quotes';
import { listOrders } from '@/lib/sales/orders';
import { listComplaints } from '@/lib/sales/complaints';

const LINKS = [
  { href: '/dashboard/sales/leads', label: 'Aday Müşteriler (Lead)' },
  { href: '/dashboard/sales/opportunities', label: 'Fırsatlar' },
  { href: '/dashboard/sales/quotes', label: 'Teklifler' },
  { href: '/dashboard/sales/orders', label: 'Siparişler' },
  { href: '/dashboard/sales/invoices', label: 'Faturalar' },
  { href: '/dashboard/sales/complaints', label: 'Müşteri Şikayetleri' },
  { href: '/dashboard/master-data/parties', label: 'Cariler (Müşteri/Tedarikçi)' }
];

export default async function SalesHomePage() {
  const session = await requireSession();
  const [leads, opportunities, quotes, orders, complaints] = await Promise.all([
    listLeads(session.companyId), listOpportunities(session.companyId), listQuotes(session.companyId), listOrders(session.companyId), listComplaints(session.companyId)
  ]);
  const openLeads = leads.filter((l) => l.status !== 'CONVERTED' && l.status !== 'DISQUALIFIED').length;
  const openOpportunities = opportunities.filter((o) => o.stage !== 'WON' && o.stage !== 'LOST').length;
  const pendingOrders = orders.filter((o) => o.status === 'SUBMITTED').length;
  const openComplaints = complaints.filter((c) => c.status !== 'CLOSED').length;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Satış & CRM</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Aday Müşteri → Fırsat → Teklif → Sipariş → Sevkiyat → Fatura → Tahsilat (Holding ERP Faz 1).</p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Açık Aday Müşteri" value={openLeads} />
        <Stat label="Açık Fırsat" value={openOpportunities} />
        <Stat label="Toplam Teklif" value={quotes.length} />
        <Stat label="Onay Bekleyen Sipariş" value={pendingOrders} />
        <Stat label="Açık Şikayet" value={openComplaints} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {LINKS.map((l) => <Link key={l.href} href={l.href} style={{ fontSize: 14 }}>{l.label} →</Link>)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: '10px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{label}</div>
    </div>
  );
}
