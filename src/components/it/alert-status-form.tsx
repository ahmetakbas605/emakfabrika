'use client';

import { useActionState } from 'react';
import { updateAlertStatusAction, type FormState } from '@/actions/it/monitoring';

export function AlertStatusForm({ departmentId, alertId, currentStatus }: { departmentId: string; alertId: string; currentStatus: string }) {
  const action = updateAlertStatusAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="alertId" value={alertId} />
      <select name="status" defaultValue={currentStatus} style={{ padding: 3, fontSize: 12 }}>
        <option value="OPEN">OPEN</option>
        <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
        <option value="RESOLVED">RESOLVED</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
