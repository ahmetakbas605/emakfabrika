'use client';

import { useActionState } from 'react';
import { createCashAccountAction, type FormState } from '@/actions/cash';

export function CashAccountForm({ departmentId, accounts }: { departmentId: string; accounts: { id: string; code: string; name: string }[] }) {
  const action = createCashAccountAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kasa Adı</label>
        <input name="name" required style={{ padding: 6, width: 200 }} placeholder="Merkez Kasa" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bağlı Hesap</label>
        <select name="accountingAccountId" required style={{ padding: 6, minWidth: 220 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Kasa Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
