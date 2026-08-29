'use client';

import { useActionState } from 'react';
import { createCategoryAction, type FormState } from '@/actions/it/knowledge-base';

export function KbCategoryForm({ departmentId, categories }: { departmentId: string; categories: { id: string; name: string }[] }) {
  const action = createCategoryAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kategori Adı</label><input name="name" required style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üst Kategori (opsiyonel)</label>
        <select name="parentCategoryId" style={{ padding: 6 }}>
          <option value="">Yok</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kategori Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
