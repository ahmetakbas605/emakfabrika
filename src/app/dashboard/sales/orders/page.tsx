import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listOrders } from '@/lib/sales/orders';
import { listParties } from '@/lib/master-data/parties';
import { listProducts } from '@/lib/master-data/products';
import { CreateOrderForm, SubmitOrderButton, CancelOrderButton } from '@/components/sales/order-forms';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', SUBMITTED: 'Onayda', CONFIRMED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli',
  IN_FULFILLMENT: 'Kısmen Sevk Edildi', SHIPPED: 'Sevk Edildi', INVOICED: 'Faturalandı', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal'
};

export default async function SalesOrdersPage() {
  const session = await requireSession();
  const [orders, parties, products] = await Promise.all([listOrders(session.companyId), listParties(session.companyId), listProducts(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Satış Siparişleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Onay motoru genel (bkz. Onay Kutısı) — bir onay kuralı tanımlı değilse gönderim reddedilir.</p>

      <div style={{ marginBottom: 20 }}><CreateOrderForm parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Cari</th><th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/sales/orders/${o.id}`}>{o.orderNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{o.partyName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{o.orderDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[o.status] ?? o.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {o.status === 'DRAFT' || o.status === 'REVISION_REQUIRED' ? (
                  <>
                    <SubmitOrderButton orderId={o.id} />
                    <CancelOrderButton orderId={o.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz sipariş yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
