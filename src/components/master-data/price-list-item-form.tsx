'use client';

import { useActionState } from 'react';
import { setPriceListItemAction, type FormState } from '@/actions/master-data';

export function PriceListItemForm({ priceListId, products }: { priceListId: string; products: { id: string; sku: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setPriceListItemAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="priceListId" value={priceListId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ürün</label>
        <select name="productId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Fiyat</label>
        <input name="price" required style={{ padding: 6, width: 100 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İndirim (%)</label>
        <input name="discountPercent" style={{ padding: 6, width: 80 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Fiyat Ekle/Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
