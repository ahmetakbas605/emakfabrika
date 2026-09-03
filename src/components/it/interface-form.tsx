'use client';

import { useActionState } from 'react';
import { createInterfaceAction, type FormState } from '@/actions/it/network';

export function InterfaceForm({ departmentId, assets, vlans }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[]; vlans: { id: string; vlanNumber: number; name: string }[] }) {
  const action = createInterfaceAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Varlık</label>
        <select name="assetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Arayüz Adı</label><input name="name" placeholder="eth0" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>MAC</label><input name="macAddress" placeholder="AA:BB:CC:DD:EE:FF" style={{ padding: 6, width: 160 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="interfaceType" style={{ padding: 6 }}>
          <option value="ETHERNET">Ethernet</option>
          <option value="FIBER">Fiber</option>
          <option value="WIFI">WiFi</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>VLAN</label>
        <select name="vlanId" style={{ padding: 6 }}>
          <option value="">Seçilmedi</option>
          {vlans.map((v) => <option key={v.id} value={v.id}>{v.vlanNumber} — {v.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Arayüz Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
