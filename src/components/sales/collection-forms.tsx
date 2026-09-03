'use client';

import { useActionState } from 'react';
import { createCollectionAction, type FormState } from '@/actions/sales-collections';

export function CreateCollectionForm({ invoiceId, currencyCode }: { invoiceId: string; currencyCode: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCollectionAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 8, borderRadius: 4 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="currencyCode" value={currencyCode} />
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Tarih</label><input name="collectionDate" type="date" required style={{ padding: 5 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Tutar</label><input name="amount" type="number" step="0.01" required style={{ padding: 5, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Yöntem</label>
        <select name="method" style={{ padding: 5 }}>
          <option value="BANK">Banka</option><option value="CASH">Nakit</option><option value="CHECK">Çek</option><option value="OTHER">Diğer</option>
        </select>
      </div>
      <input name="cashOrBankAccountCode" placeholder="Kasa/Banka hesabı (ops.)" style={{ padding: 5, width: 130, fontSize: 12 }} />
      <input name="receivableAccountCode" placeholder="Alıcılar hesabı (ops.)" style={{ padding: 5, width: 120, fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Tahsilat Kaydet'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 11, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
