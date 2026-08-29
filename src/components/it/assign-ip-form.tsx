'use client';

import { useActionState } from 'react';
import { assignIpAction, type FormState } from '@/actions/it/network';

export function AssignIpForm({ departmentId, subnetId, prefillIp, assets }: { departmentId: string; subnetId: string; prefillIp?: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = assignIpAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="subnetId" value={subnetId} />
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>IP Adresi</label><input name="ipAddress" defaultValue={prefillIp} required style={{ padding: 6, width: 140 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık</label>
        <select name="assetId" style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçilmedi</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="assignmentType" style={{ padding: 6 }}>
          <option value="STATIC">Statik</option>
          <option value="DHCP">DHCP</option>
          <option value="RESERVED">Rezerve</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'IP Ata'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
