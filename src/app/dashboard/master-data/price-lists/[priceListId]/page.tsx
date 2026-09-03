import { requireFactoryAdmin } from '@/lib/dal';
import { getPriceList } from '@/lib/master-data/price-lists';
import { listProducts } from '@/lib/master-data/products';
import { PriceListItemForm } from '@/components/master-data/price-list-item-form';

export default async function PriceListDetailPage({ params }: { params: Promise<{ priceListId: string }> }) {
  const { priceListId } = await params;
  const session = await requireFactoryAdmin();
  const [{ list, items }, products] = await Promise.all([
    getPriceList(session.companyId, priceListId),
    listProducts(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{list.name}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>{list.currencyCode} · {list.validFrom ?? '—'} → {list.validTo ?? '—'}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>SKU</th>
            <th style={{ padding: '6px 8px' }}>Ürün</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Fiyat</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>İndirim</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{i.productSku}</td>
              <td style={{ padding: '6px 8px' }}>{i.productName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(i.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{i.discountPercent ? `%${i.discountPercent}` : '—'}</td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz fiyat satırı yok.</td></tr> : null}
        </tbody>
      </table>

      <PriceListItemForm priceListId={priceListId} products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} />
    </div>
  );
}
