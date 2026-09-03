'use client';

import { useActionState } from 'react';
import { openPeriodAction, type FormState } from '@/actions/accounting';

export function PeriodForm({ departmentId }: { departmentId: string }) {
  const action = openPeriodAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6, maxWidth: 420 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label>
        <input name="periodStart" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label>
        <input name="periodEnd" type="date" required style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Açılıyor...' : 'Dönem Aç'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
    </form>
  );
}
