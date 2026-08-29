'use client';

import { useActionState } from 'react';
import { recordExchangeRateAction, type FormState } from '@/actions/master-data';

export function ExchangeRateForm({ currencies }: { currencies: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordExchangeRateAction, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label>
        <select name="currencyCode" required style={{ padding: 6 }}>
          {currencies.filter((c) => c.code !== 'TRY').map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label>
        <input name="rateDate" type="date" defaultValue={today} required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kur (TRY karşılığı)</label>
        <input name="rate" required style={{ padding: 6, width: 120 }} placeholder="34.50" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="rateType" style={{ padding: 6 }}>
          <option value="EFFECTIVE">Efektif</option>
          <option value="BUY">Alış</option>
          <option value="SELL">Satış</option>
          <option value="CENTRAL_BANK">Merkez Bankası</option>
          <option value="CUSTOM">Özel</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Kaydediliyor...' : 'Kur Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
