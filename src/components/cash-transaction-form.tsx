'use client';

import { useActionState } from 'react';
import { recordCashTransactionAction, type FormState } from '@/actions/cash';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CashTransactionForm({
  departmentId,
  cashAccounts,
  accounts
}: {
  departmentId: string;
  cashAccounts: { id: string; name: string }[];
  accounts: { code: string; name: string }[];
}) {
  const action = recordCashTransactionAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kasa</label>
        <select name="cashAccountId" required style={{ padding: 6 }}>
          {cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yön</label>
        <select name="transactionType" style={{ padding: 6 }}>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tutar</label>
        <input name="amount" type="number" step="any" min={0.01} required style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Karşı Hesap</label>
        <select name="counterAccountCode" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label>
        <input name="transactionDate" type="date" defaultValue={todayIso()} required style={{ padding: 6 }} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label>
        <input name="description" style={{ padding: 6, width: '100%' }} placeholder="Opsiyonel" />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Kaydediliyor...' : 'Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
