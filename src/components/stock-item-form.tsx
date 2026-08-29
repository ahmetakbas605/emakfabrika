'use client';

import { useActionState } from 'react';
import { createStockItemAction, type FormState } from '@/actions/warehouse';

export function StockItemForm({ departmentId, accounts, products }: { departmentId: string; accounts: { id: string; code: string; name: string }[]; products: { id: string; sku: string; name: string }[] }) {
  const action = createStockItemAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>SKU</label>
        <input name="sku" required style={{ padding: 6, width: 100 }} placeholder="YP-001" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 200 }} placeholder="Power Adapter" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim</label>
        <input name="unit" style={{ padding: 6, width: 80 }} placeholder="ADET" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Stok Değer Hesabı (opsiyonel)</label>
        <select name="accountingAccountId" style={{ padding: 6, minWidth: 180 }}>
          <option value="">Yalnızca miktar takibi</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Master Ürün (opsiyonel)</label>
        <select name="productId" style={{ padding: 6, minWidth: 180 }}>
          <option value="">Bağımsız stok kartı</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Stok Kartı Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
