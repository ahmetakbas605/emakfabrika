'use client';

import { useActionState } from 'react';
import { createArticleAction, type FormState } from '@/actions/it/knowledge-base';

export function KbArticleForm({ departmentId, categories }: { departmentId: string; categories: { id: string; name: string }[] }) {
  const action = createArticleAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6, maxWidth: 560 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kategori (opsiyonel)</label>
        <select name="categoryId" style={{ padding: 6 }}>
          <option value="">Yok</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label><input name="title" required style={{ padding: 6, width: '100%' }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İçerik</label><textarea name="content" required rows={5} style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Makale Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
