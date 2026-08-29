'use client';

import { useActionState } from 'react';
import { createPriceListAction, type FormState } from '@/actions/master-data';

export function PriceListForm({ currencies, parties }: { currencies: { code: string }[]; parties: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPriceListAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 200 }} placeholder="Genel Fiyat Listesi" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label>
        <select name="currencyCode" required style={{ padding: 6 }}>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Müşteriye Özel (opsiyonel)</label>
        <select name="partyId" style={{ padding: 6 }}>
          <option value="">— (genel liste)</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Başlangıcı</label>
        <input name="validFrom" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Bitişi</label>
        <input name="validTo" type="date" style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Liste Oluştur'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
