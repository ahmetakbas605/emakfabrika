import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listProductionOrders } from '@/lib/production/orders';
import { listProducts } from '@/lib/master-data/products';
import { listUnits } from '@/lib/master-data/units';
import { listWarehouses } from '@/lib/warehouse';
import { CreateProductionOrderForm, SubmitProductionOrderButton, CancelProductionOrderButton } from '@/components/production/order-forms';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', SUBMITTED: 'Onayda', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli',
  RELEASED: 'Serbest Bırakıldı', IN_PROGRESS: 'Devam Ediyor', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal'
};

export default async function ProductionOrdersPage() {
  const session = await requireSession();
  const [orders, products, units, warehouses] = await Promise.all([
    listProductionOrders(session.companyId), listProducts(session.companyId), listUnits(session.companyId), listWarehouses(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Üretim Emirleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Onay motoru genel (bkz. Onay Kutusu) — seçilen ürünün geçerli (ACTIVE) bir BOM'u olmalı.</p>

      <div style={{ marginBottom: 20 }}>
        <CreateProductionOrderForm products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} units={units.map((u) => ({ id: u.id, code: u.code }))} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/production/orders/${o.id}`}>{o.orderNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{o.productName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{o.quantity}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[o.status] ?? o.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {o.status === 'DRAFT' || o.status === 'REVISION_REQUIRED' ? (
                  <>
                    <SubmitProductionOrderButton orderId={o.id} />
                    <CancelProductionOrderButton orderId={o.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz üretim emri yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
