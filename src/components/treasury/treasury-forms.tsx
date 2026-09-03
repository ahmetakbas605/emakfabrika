'use client';

import { useActionState } from 'react';
import { createCashFlowItemAction, markCashFlowItemRealizedAction, cancelCashFlowItemAction, type FormState } from '@/actions/treasury';

export function CreateCashFlowItemForm({ currencies }: { currencies: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCashFlowItemAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yön</label>
        <select name="direction" required style={{ padding: 6 }}>
          <option value="INFLOW">Tahsilat (Giriş)</option>
          <option value="OUTFLOW">Ödeme (Çıkış)</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama</label><input name="description" required style={{ padding: 6, width: 200 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tutar</label><input name="amount" type="number" step="0.01" required style={{ padding: 6, width: 100 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Para Birimi</label>
        <select name="currencyCode" required style={{ padding: 6 }}>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Beklenen Tarih</label><input name="expectedDate" type="date" required style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kalem Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function MarkCashFlowItemRealizedButton({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markCashFlowItemRealizedAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="itemId" value={itemId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Gerçekleşti'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelCashFlowItemButton({ itemId }: { itemId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelCashFlowItemAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginLeft: 4 }}>
      <input type="hidden" name="itemId" value={itemId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'İptal'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
