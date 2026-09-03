'use client';

import { useActionState } from 'react';
import { createProblemAction, type FormState } from '@/actions/it/problems';

export function ProblemForm({ departmentId }: { departmentId: string }) {
  const action = createProblemAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label>
        <input name="title" required style={{ padding: 6, width: '100%' }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Problem Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
