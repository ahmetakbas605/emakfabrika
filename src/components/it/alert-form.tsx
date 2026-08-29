'use client';

import { useActionState } from 'react';
import { createAlertAction, type FormState } from '@/actions/it/monitoring';

export function AlertForm({ departmentId, targets }: { departmentId: string; targets: { id: string; assetTag: string }[] }) {
  const action = createAlertAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hedef</label>
        <select name="targetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.assetTag}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Önem</label>
        <select name="severity" style={{ padding: 6 }}>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
          <option value="INFO">INFO</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Mesaj</label><input name="message" required style={{ padding: 6, minWidth: 200 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Alert Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
