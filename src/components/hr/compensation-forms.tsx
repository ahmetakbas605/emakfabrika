'use client';

import { useActionState } from 'react';
import { createCompensationAction, type FormState } from '@/actions/hr-compensation';

export function CompensationForm({ departmentId, employeeId, currencies }: { departmentId: string; employeeId: string; currencies: { code: string; name: string }[] }) {
  const action = createCompensationAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yürürlük Tarihi</label><input name="effectiveDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Maaş</label><input name="baseSalary" type="number" step="0.01" min={0} required style={{ padding: 6, width: 120 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Para Birimi</label>
        <select name="currencyCode" required style={{ padding: 6, width: 90 }}>{currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Değişiklik Nedeni</label><input name="changeReason" style={{ padding: 6, width: 160 }} placeholder="Zam / Terfi / İşe Giriş" /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Yeni Maaş Kaydet'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
