import Link from 'next/link';
import { requireFactoryAdmin } from '@/lib/dal';
import { listProducts, listProductCats, listBrands } from '@/lib/master-data/products';
import { listUnits } from '@/lib/master-data/units';
import { ProductForm } from '@/components/master-data/product-form';
import { ProductCatForm, BrandForm } from '@/components/master-data/product-taxonomy-forms';

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  STOCK_ITEM: 'Stoklu Ürün', SERVICE: 'Hizmet', ASSET: 'Demirbaş', KIT: 'Kit', NON_STOCK: 'Stoksuz', CONSUMABLE: 'Sarf Malzeme', SPARE_PART: 'Yedek Parça'
};

export default async function ProductsPage() {
  const session = await requireFactoryAdmin();
  const [products, categories, brands, units] = await Promise.all([
    listProducts(session.companyId),
    listProductCats(session.companyId),
    listBrands(session.companyId),
    listUnits(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ürünler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Tek Ürün Master&apos;ı (madde 189-190) — Depo/Satınalma/Satış hepsinin ortak referansı.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>SKU</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Tip</th>
            <th style={{ padding: '6px 8px' }}>Marka</th>
            <th style={{ padding: '6px 8px' }}>Kategori</th>
            <th style={{ padding: '6px 8px' }}>Birim</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/master-data/products/${p.id}`}>{p.sku}</Link></td>
              <td style={{ padding: '6px 8px' }}>{p.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{PRODUCT_TYPE_LABEL[p.productType] ?? p.productType}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.brandName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.categoryName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.baseUnitCode}</td>
            </tr>
          ))}
          {products.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz ürün yok.</td></tr> : null}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Kategori Ekle</h3>
          <ProductCatForm categories={categories} />
        </div>
        <div style={{ border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Marka Ekle</h3>
          <BrandForm />
        </div>
      </div>

      {units.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13, marginBottom: 12 }}>Önce en az bir birim tanımlanmalı (Birimler sayfası).</p>
      ) : (
        <ProductForm units={units.map((u) => ({ id: u.id, code: u.code }))} brands={brands} categories={categories} />
      )}
    </div>
  );
}
