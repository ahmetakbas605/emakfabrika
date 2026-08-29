'use client';

import { useActionState } from 'react';
import { recordBackupResultAction, type FormState } from '@/actions/it/backup';

export function BackupResultForm({ departmentId, jobs }: { departmentId: string; jobs: { id: string; source: string; assetTag: string }[] }) {
  const action = recordBackupResultAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İş</label>
        <select name="backupJobId" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.assetTag} — {j.source}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sonuç</label>
        <select name="result" style={{ padding: 6 }}>
          <option value="SUCCESS">Başarılı</option>
          <option value="FAILED">Başarısız</option>
          <option value="PARTIAL">Kısmi</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hata Mesajı (opsiyonel)</label><input name="errorMessage" style={{ padding: 6, minWidth: 160 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Sonuç Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
