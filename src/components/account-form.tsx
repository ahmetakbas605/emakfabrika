'use client';

import { useActionState } from 'react';
import { createAccountAction, type FormState } from '@/actions/accounting';

export function AccountForm({ departmentId }: { departmentId: string }) {
  const action = createAccountAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label>
        <input name="code" required style={{ padding: 6, width: 90 }} placeholder="100" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 220 }} placeholder="Kasa" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="accountType" style={{ padding: 6 }}>
          <option value="ASSET">Varlık (ASSET)</option>
          <option value="LIABILITY">Borç (LIABILITY)</option>
          <option value="EQUITY">Özkaynak (EQUITY)</option>
          <option value="REVENUE">Gelir (REVENUE)</option>
          <option value="EXPENSE">Gider (EXPENSE)</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Normal Bakiye</label>
        <select name="normalBalance" style={{ padding: 6 }}>
          <option value="DEBIT">Borç</option>
          <option value="CREDIT">Alacak</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Hesap Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
