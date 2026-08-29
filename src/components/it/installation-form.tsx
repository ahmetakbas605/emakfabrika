'use client';

import { useActionState } from 'react';
import { createInstallationAction, type FormState } from '@/actions/it/licensing';

export function InstallationForm({ departmentId, products, assets }: { departmentId: string; products: { id: string; name: string }[]; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = createInstallationAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yazılım</label>
        <select name="productId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık</label>
        <select name="assetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sürüm</label><input name="installedVersion" style={{ padding: 6, width: 100 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kurulum Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
