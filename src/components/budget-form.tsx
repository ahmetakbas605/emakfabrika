'use client';

import { useActionState } from 'react';
import { createBudgetAction, type FormState } from '@/actions/budgets';

export function BudgetForm({ departmentId }: { departmentId: string }) {
  const action = createBudgetAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 220 }} placeholder="2026 Yıllık Bütçe" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label>
        <input name="periodStart" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label>
        <input name="periodEnd" type="date" required style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'Bütçe Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
    </form>
  );
}
