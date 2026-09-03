'use client';

import { useActionState, useState } from 'react';
import { createCheckAction, type FormState } from '@/actions/checks';

export function CheckForm({ departmentId, accounts }: { departmentId: string; accounts: { id: string; code: string; name: string }[] }) {
  const action = createCheckAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [direction, setDirection] = useState<'RECEIVED' | 'ISSUED'>('RECEIVED');

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yön</label>
        <select name="direction" value={direction} onChange={(e) => setDirection(e.target.value as 'RECEIVED' | 'ISSUED')} style={{ padding: 6 }}>
          <option value="RECEIVED">Alınan Çek</option>
          <option value="ISSUED">Verilen Çek</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Çek No</label>
        <input name="checkNo" required style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Banka</label>
        <input name="bankName" style={{ padding: 6, width: 140 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{direction === 'RECEIVED' ? 'Keşideci' : 'Lehtar'}</label>
        <input name="partyName" required style={{ padding: 6, width: 160 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tutar</label>
        <input name="amount" type="number" step="any" min={0.01} required style={{ padding: 6, width: 110 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Vade</label>
        <input name="dueDate" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{direction === 'RECEIVED' ? '101 Alınan Çekler' : '103 Verilen Çekler'} Hesabı</label>
        <select name="accountingAccountId" required style={{ padding: 6, minWidth: 180 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      {direction === 'RECEIVED' ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Karşı Hesap (ör. Alıcılar)</label>
          <select name="counterAccountCode" style={{ padding: 6, minWidth: 180 }}>
            <option value="">Seçin...</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
        </div>
      ) : null}
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Kaydediliyor...' : 'Çek Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
