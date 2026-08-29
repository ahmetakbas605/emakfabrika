'use client';

import { useActionState } from 'react';
import { createVlanAction, type FormState } from '@/actions/it/network';

export function VlanForm({ departmentId }: { departmentId: string }) {
  const action = createVlanAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>VLAN No</label><input name="vlanNumber" type="number" min={1} required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Amaç</label><input name="purpose" placeholder="ör. Sunucular" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'VLAN Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
