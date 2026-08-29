'use client';

import { useActionState } from 'react';
import { updateProblemAction, type FormState } from '@/actions/it/problems';

export function ProblemStatusForm({ departmentId, problemId, currentStatus, currentRootCause }: { departmentId: string; problemId: string; currentStatus: string; currentRootCause: string | null }) {
  const action = updateProblemAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="problemId" value={problemId} />
      <select name="toStatus" defaultValue={currentStatus} style={{ padding: 3, fontSize: 12 }}>
        <option value="OPEN">OPEN</option>
        <option value="ROOT_CAUSE_IDENTIFIED">ROOT_CAUSE_IDENTIFIED</option>
        <option value="RESOLVED">RESOLVED</option>
        <option value="CLOSED">CLOSED</option>
      </select>
      <input name="rootCause" defaultValue={currentRootCause ?? ''} placeholder="Kök neden" style={{ padding: 3, fontSize: 12, width: 140 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
