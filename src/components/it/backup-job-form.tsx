'use client';

import { useActionState } from 'react';
import { createBackupJobAction, type FormState } from '@/actions/it/backup';

export function BackupJobForm({ departmentId, assets }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = createBackupJobAction.bind(null, departmentId);
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
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kaynak</label><input name="source" required style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hedef</label><input name="destination" required style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Zamanlama</label><input name="schedule" placeholder="ör. Her gece 02:00" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Saklama (gün)</label><input name="retentionDays" type="number" min={1} defaultValue={30} style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Yedekleme İşi Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
