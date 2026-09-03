'use client';

import { useActionState } from 'react';
import { createContractAction, type FormState } from '@/actions/it/licensing';

export function ContractForm({ departmentId, vendors, assets }: { departmentId: string; vendors: { id: string; name: string }[]; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = createContractAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6, maxWidth: 520 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label><input name="title" required style={{ padding: 6, width: '100%' }} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
          <select name="contractType" required style={{ padding: 6, width: '100%' }}>
            <option value="SUPPORT">Destek</option>
            <option value="MAINTENANCE">Bakım</option>
            <option value="SERVICE">Hizmet</option>
            <option value="LEASE">Kiralama</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tedarikçi</label>
          <select name="vendorId" style={{ padding: 6, width: '100%' }}>
            <option value="">Seçilmedi</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label><input name="startDate" type="date" required style={{ padding: 6, width: '100%' }} /></div>
        <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label><input name="endDate" type="date" required style={{ padding: 6, width: '100%' }} /></div>
        <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Maliyet</label><input name="cost" type="number" step="0.01" style={{ padding: 6, width: '100%' }} /></div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kapsanan Varlıklar (opsiyonel)</label>
        <select name="assetIds" multiple style={{ padding: 6, width: '100%', minHeight: 80 }}>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Sözleşme Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
