'use client';

import { useActionState } from 'react';
import { createPaymentTermAction, type FormState } from '@/actions/master-data';

export function PaymentTermForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPaymentTermAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kod</label>
        <input name="code" required style={{ padding: 6, width: 100 }} placeholder="NET30" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 180 }} placeholder="30 Gün Vadeli" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Vade (gün)</label>
        <input name="netDays" type="number" min="0" required style={{ padding: 6, width: 80 }} placeholder="30" />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Vade Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
