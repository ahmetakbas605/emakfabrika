'use client';

import { useActionState } from 'react';
import { recordComplianceAction, type FormState } from '@/actions/it/compliance';

const STATUS_OPTIONS = ['COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN'];

function StatusSelect({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>{label}</label>
      <select name={name} style={{ padding: 6 }}>
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

export function ComplianceForm({ departmentId, assets }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = recordComplianceAction.bind(null, departmentId);
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
      <StatusSelect name="antivirusStatus" label="Antivirüs" />
      <StatusSelect name="firewallStatus" label="Güvenlik Duvarı" />
      <StatusSelect name="encryptionStatus" label="Şifreleme" />
      <StatusSelect name="patchStatus" label="Yama" />
      <StatusSelect name="osSupportStatus" label="OS Desteği" />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kayıt Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
