'use client';

import { useActionState } from 'react';
import { createLicenseAction, type FormState } from '@/actions/it/licensing';

export function LicenseForm({ departmentId, products, vendors }: { departmentId: string; products: { id: string; name: string }[]; vendors: { id: string; name: string }[] }) {
  const action = createLicenseAction.bind(null, departmentId);
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
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tedarikçi</label>
        <select name="vendorId" style={{ padding: 6 }}>
          <option value="">Seçilmedi</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Lisans Anahtarı</label><input name="licenseKey" style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Koltuk</label><input name="seats" type="number" min={1} defaultValue={1} style={{ padding: 6, width: 70 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Satın Alma</label><input name="purchaseDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="expiresAt" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maliyet</label><input name="cost" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Lisans Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
