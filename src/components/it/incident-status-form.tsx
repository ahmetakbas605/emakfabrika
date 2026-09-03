'use client';

import { useActionState } from 'react';
import { changeIncidentStatusAction, type FormState } from '@/actions/it/incidents';

export function IncidentStatusForm({ departmentId, incidentId, currentStatus }: { departmentId: string; incidentId: string; currentStatus: string }) {
  const action = changeIncidentStatusAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="incidentId" value={incidentId} />
      <select name="toStatus" defaultValue={currentStatus} style={{ padding: 3, fontSize: 12 }}>
        <option value="OPEN">OPEN</option>
        <option value="INVESTIGATING">INVESTIGATING</option>
        <option value="RESOLVED">RESOLVED</option>
        <option value="CLOSED">CLOSED</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
