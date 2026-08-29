'use client';

import { useActionState } from 'react';
import { createProductAction, type FormState } from '@/actions/master-data';

export function ProductForm({ units, brands, categories }: { units: { id: string; code: string }[]; brands: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProductAction, undefined);
  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      <div style={{ gridColumn: 'span 3' }}><h3 style={{ fontSize: 14, margin: 0 }}>Yeni Ürün</h3></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>SKU</label>
        <input name="sku" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kısa Ad</label>
        <input name="shortName" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ürün Tipi</label>
        <select name="productType" style={{ padding: 6, width: '100%' }}>
          <option value="STOCK_ITEM">Stoklu Ürün</option>
          <option value="SERVICE">Hizmet</option>
          <option value="ASSET">Demirbaş</option>
          <option value="KIT">Kit</option>
          <option value="NON_STOCK">Stoksuz</option>
          <option value="CONSUMABLE">Sarf Malzeme</option>
          <option value="SPARE_PART">Yedek Parça</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Takip Türü</label>
        <select name="trackingType" style={{ padding: 6, width: '100%' }}>
          <option value="NONE">Yok</option>
          <option value="SERIAL">Seri No</option>
          <option value="LOT">Lot/Parti</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Taban Birim</label>
        <select name="baseUnitId" required style={{ padding: 6, width: '100%' }}>
          <option value="">Seçin</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Marka</label>
        <select name="brandId" style={{ padding: 6, width: '100%' }}>
          <option value="">—</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kategori</label>
        <select name="categoryId" style={{ padding: 6, width: '100%' }}>
          <option value="">—</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>KDV Oranı (%)</label>
        <input name="taxRatePercent" style={{ padding: 6, width: '100%' }} placeholder="20" />
      </div>
      <div style={{ gridColumn: 'span 3' }}>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label>
        <textarea name="description" rows={2} style={{ padding: 6, width: '100%' }} />
      </div>
      <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Ürün Ekle'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 13 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 13 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
