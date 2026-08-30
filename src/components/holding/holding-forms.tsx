'use client';

import { useActionState } from 'react';
import { createHoldingAction, moveCompanyToHoldingAction, type FormState } from '@/actions/holding';

export function CreateHoldingForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createHoldingAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yeni Holding Adı</label>
        <input name="name" required style={{ padding: 6, width: 260 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Holding Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, marginLeft: 8 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, marginLeft: 8 }}>{state.success}</p> : null}
    </form>
  );
}

export function MoveCompanyForm({ companies, holdings }: { companies: { id: string; name: string; holdingId: string | null }[]; holdings: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(moveCompanyToHoldingAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şirket</label>
        <select name="companyId" required style={{ padding: 6, width: 220 }}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hedef Holding</label>
        <select name="targetHoldingId" required style={{ padding: 6, width: 220 }}>
          {holdings.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Taşı'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, marginLeft: 8 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, marginLeft: 8 }}>{state.success}</p> : null}
    </form>
  );
}
