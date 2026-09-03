'use client';

import { useActionState } from 'react';
import { createPartyAction, type FormState } from '@/actions/master-data';

export function PartyForm({ currencies, paymentTerms }: { currencies: { code: string; name: string }[]; paymentTerms: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPartyAction, undefined);

  return (
    <form action={formAction} style={{ border: '1px solid var(--dim-border-soft)', padding: 16, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      <div style={{ gridColumn: 'span 3' }}><h3 style={{ fontSize: 14, margin: 0 }}>Yeni Cari Kartı</h3></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Unvan</label>
        <input name="legalName" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ticari Ad</label>
        <input name="tradeName" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kod (boşsa otomatik)</label>
        <input name="code" style={{ padding: 6, width: '100%' }} placeholder="CARI2026000001" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="partyType" style={{ padding: 6, width: '100%' }}>
          <option value="COMPANY">Şirket</option>
          <option value="PERSON">Şahıs</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>VKN/TCKN</label>
        <input name="taxNumber" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Vergi Dairesi</label>
        <input name="taxOffice" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>E-posta</label>
        <input name="email" type="email" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Telefon</label>
        <input name="phone" style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Para Birimi</label>
        <select name="currencyCode" style={{ padding: 6, width: '100%' }}>
          <option value="">—</option>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ödeme Vadesi</label>
        <select name="paymentTermId" style={{ padding: 6, width: '100%' }}>
          <option value="">—</option>
          {paymentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="roleCustomer" /> Müşteri</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="roleSupplier" /> Tedarikçi</label>
      </div>
      <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Cari Ekle'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 13 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 13 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
