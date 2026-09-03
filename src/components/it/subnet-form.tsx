'use client';

import { useActionState } from 'react';
import { createSubnetAction, type FormState } from '@/actions/it/network';

export function SubnetForm({ departmentId, vlans }: { departmentId: string; vlans: { id: string; vlanNumber: number; name: string }[] }) {
  const action = createSubnetAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>CIDR</label><input name="cidr" placeholder="192.168.1.0/24" required style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Gateway</label><input name="gateway" placeholder="192.168.1.1" style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>VLAN</label>
        <select name="vlanId" style={{ padding: 6 }}>
          <option value="">Seçilmedi</option>
          {vlans.map((v) => <option key={v.id} value={v.id}>{v.vlanNumber} — {v.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama</label><input name="description" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Subnet Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
