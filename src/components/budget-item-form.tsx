'use client';

import { useActionState } from 'react';
import { addBudgetItemAction, type FormState } from '@/actions/budgets';

export function BudgetItemForm({ departmentId, budgetId, accounts }: { departmentId: string; budgetId: string; accounts: { code: string; id: string; name: string }[] }) {
  const action = addBudgetItemAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="budgetId" value={budgetId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hesap</label>
        <select name="accountId" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ay (opsiyonel, boşsa yıllık)</label>
        <input name="month" type="number" min={1} max={12} style={{ padding: 6, width: 80 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Planlanan Tutar</label>
        <input name="plannedAmount" type="number" step="any" min={0.01} required style={{ padding: 6, width: 140 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Kalem Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
    </form>
  );
}
