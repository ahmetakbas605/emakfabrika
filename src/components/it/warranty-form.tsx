'use client';

import { useActionState } from 'react';
import { createWarrantyAction, type FormState } from '@/actions/it/licensing';

export function WarrantyForm({ departmentId, assets, vendors }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[]; vendors: { id: string; name: string }[] }) {
  const action = createWarrantyAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık</label>
        <select name="assetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tedarikçi</label>
        <select name="vendorId" style={{ padding: 6 }}>
          <option value="">Seçilmedi</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="startDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="endDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maliyet</label><input name="cost" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Garanti Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
