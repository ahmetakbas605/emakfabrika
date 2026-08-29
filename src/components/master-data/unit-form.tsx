'use client';

import { useActionState } from 'react';
import { createUnitAction, type FormState } from '@/actions/master-data';

export function UnitForm({ units }: { units: { id: string; code: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createUnitAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label>
        <input name="code" required style={{ padding: 6, width: 100 }} placeholder="KOLI" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 160 }} placeholder="Koli" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Taban Birim (opsiyonel)</label>
        <select name="baseUnitId" style={{ padding: 6 }}>
          <option value="">— (kendisi taban birim)</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dönüşüm Çarpanı</label>
        <input name="conversionFactor" style={{ padding: 6, width: 100 }} placeholder="24" />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Birim Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
