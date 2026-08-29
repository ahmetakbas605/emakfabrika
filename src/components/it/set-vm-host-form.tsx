'use client';

import { useActionState } from 'react';
import { setVmHostAction, type FormState } from '@/actions/it/servers';

export function SetVmHostForm({ departmentId, vms, hosts }: { departmentId: string; vms: { id: string; assetTag: string; name: string }[]; hosts: { id: string; assetTag: string; name: string }[] }) {
  const action = setVmHostAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>VM (host'suz)</label>
        <select name="vmAssetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {vms.map((v) => <option key={v.id} value={v.id}>{v.assetTag} — {v.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Host Sunucu</label>
        <select name="hostAssetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {hosts.map((h) => <option key={h.id} value={h.id}>{h.assetTag} — {h.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Host Ata'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
