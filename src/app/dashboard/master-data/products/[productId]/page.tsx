import { requireFactoryAdmin } from '@/lib/dal';
import { getProduct } from '@/lib/master-data/products';
import { listParties } from '@/lib/master-data/parties';
import { listCurrencies } from '@/lib/master-data/currency';
import { ProductBarcodeForm, ProductSupplierForm } from '@/components/master-data/product-detail-forms';

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  STOCK_ITEM: 'Stoklu Ürün', SERVICE: 'Hizmet', ASSET: 'Demirbaş', KIT: 'Kit', NON_STOCK: 'Stoksuz', CONSUMABLE: 'Sarf Malzeme', SPARE_PART: 'Yedek Parça'
};
const TRACKING_LABEL: Record<string, string> = { NONE: 'Yok', SERIAL: 'Seri No', LOT: 'Lot/Parti' };

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const session = await requireFactoryAdmin();
  const [{ product, barcodes, suppliers }, allSuppliers, currencies] = await Promise.all([
    getProduct(session.companyId, productId),
    listParties(session.companyId, { role: 'SUPPLIER' }),
    listCurrencies()
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{product.sku} — {product.name}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        {PRODUCT_TYPE_LABEL[product.productType] ?? product.productType} · Takip: {TRACKING_LABEL[product.trackingType] ?? product.trackingType}
        {product.taxRatePercent ? ` · KDV %${product.taxRatePercent}` : ''}
      </p>
      {product.description ? <p style={{ marginBottom: 20, fontSize: 13 }}>{product.description}</p> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Barkodlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Barkod</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
          </tr>
        </thead>
        <tbody>
          {barcodes.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{b.barcode}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{b.barcodeType}</td>
            </tr>
          ))}
          {barcodes.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz barkod yok.</td></tr> : null}
        </tbody>
      </table>
      <div style={{ marginBottom: 24 }}><ProductBarcodeForm productId={productId} /></div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tedarikçiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tedarikçi</th>
            <th style={{ padding: '6px 8px' }}>Tedarikçi SKU</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Fiyat</th>
            <th style={{ padding: '6px 8px' }}>Teslim (gün)</th>
            <th style={{ padding: '6px 8px' }}>Min. Miktar</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{s.supplierName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.supplierSku || '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.purchasePrice ? `${Number(s.purchasePrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${s.currencyCode ?? ''}` : '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.leadTimeDays ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.minOrderQty ?? '—'}</td>
            </tr>
          ))}
          {suppliers.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz tedarikçi yok.</td></tr> : null}
        </tbody>
      </table>
      {allSuppliers.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>Önce Cariler sayfasında Tedarikçi rolüyle bir cari kartı oluşturun.</p>
      ) : (
        <ProductSupplierForm productId={productId} suppliers={allSuppliers.map((s) => ({ id: s.id, legalName: s.legalName }))} currencies={currencies} />
      )}
    </div>
  );
}
