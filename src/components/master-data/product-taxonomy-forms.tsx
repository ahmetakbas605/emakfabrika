'use client';

import { useActionState } from 'react';
import { createProductCatAction, createBrandAction, type FormState } from '@/actions/master-data';

export function ProductCatForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProductCatAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kategori Kodu</label>
        <input name="code" required style={{ padding: 6, width: 100 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 160 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üst Kategori</label>
        <select name="parentCategoryId" style={{ padding: 6 }}>
          <option value="">—</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Kategori Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function BrandForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createBrandAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Marka Adı</label>
        <input name="name" required style={{ padding: 6, width: 180 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Marka Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
