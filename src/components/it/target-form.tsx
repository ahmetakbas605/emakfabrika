'use client';

import { useActionState } from 'react';
import { createTargetAction, type FormState } from '@/actions/it/monitoring';

export function TargetForm({ departmentId, assets }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = createTargetAction.bind(null, departmentId);
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
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="targetType" style={{ padding: 6 }}>
          <option value="PING">Ping</option>
          <option value="SNMP">SNMP</option>
          <option value="SERVICE">Servis</option>
          <option value="PORT">Port</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Aralık (sn)</label><input name="intervalSeconds" type="number" min={30} defaultValue={300} style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Hedef Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
