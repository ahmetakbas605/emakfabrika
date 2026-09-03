'use client';

import { useActionState } from 'react';
import { createVendorAction, type FormState } from '@/actions/it/licensing';

export function VendorForm({ departmentId }: { departmentId: string }) {
  const action = createVendorAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label><input name="name" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yetkili</label><input name="contactName" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>E-posta</label><input name="contactEmail" type="email" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Telefon</label><input name="contactPhone" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Tedarikçi Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
