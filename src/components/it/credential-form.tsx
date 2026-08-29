'use client';

import { useActionState } from 'react';
import { storeCredentialAction, type FormState } from '@/actions/it/network-credentials';

export function CredentialForm({ departmentId, assets }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = storeCredentialAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık (opsiyonel)</label>
        <select name="assetId" style={{ padding: 6, minWidth: 160 }}>
          <option value="">Genel (varlık bağımsız)</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="credentialType" style={{ padding: 6 }}>
          <option value="SSH">SSH</option>
          <option value="SNMP_COMMUNITY">SNMP Community</option>
          <option value="API_KEY">API Anahtarı</option>
          <option value="VPN">VPN</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Etiket</label><input name="label" placeholder="ör. Çekirdek Switch SSH" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sır</label><input name="secret" type="password" required style={{ padding: 6, width: 180 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Şifreleyerek Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
