'use client';

import { useActionState } from 'react';
import { releaseIpAction, type FormState } from '@/actions/it/network';

export function ReleaseIpForm({ departmentId, subnetId, assignmentId }: { departmentId: string; subnetId: string; assignmentId: string }) {
  const action = releaseIpAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="subnetId" value={subnetId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Serbest Bırak'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
