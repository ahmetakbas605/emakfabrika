'use client';

import { useActionState } from 'react';
import { createPositionAction, type FormState } from '@/actions/org';

export function PositionForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPositionAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kod</label>
        <input name="code" required style={{ padding: 6, width: 120 }} placeholder="MUDUR" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Unvan</label>
        <input name="title" required style={{ padding: 6, width: 180 }} placeholder="Müdür" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Onay Seviyesi</label>
        <input name="approvalLevel" type="number" min="0" style={{ padding: 6, width: 80 }} placeholder="1" />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Pozisyon Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
