'use client';

import { useActionState } from 'react';
import { createFixedAssetAction, type FormState } from '@/actions/fixed-assets';

export function FixedAssetForm({ departmentId, accounts }: { departmentId: string; accounts: { id: string; code: string; name: string }[] }) {
  const action = createFixedAssetAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 180 }} placeholder="Forklift" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Demirbaş Hesabı</label>
        <select name="accountingAccountId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birikmiş Amortisman Hesabı</label>
        <select name="accumDeprAccountId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Amortisman Gideri Hesabı</label>
        <select name="deprExpAccountId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Alış Tarihi</label>
        <input name="purchaseDate" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maliyet</label>
        <input name="purchaseCost" type="number" step="any" min={0.01} required style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Faydalı Ömür (yıl)</label>
        <input name="usefulLifeYears" type="number" min={1} required style={{ padding: 6, width: 80 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Demirbaş Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
    </form>
  );
}
