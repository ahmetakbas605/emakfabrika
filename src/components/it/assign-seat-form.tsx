'use client';

import { useActionState } from 'react';
import { assignLicenseSeatAction, type FormState } from '@/actions/it/licensing';

export function AssignSeatForm({ departmentId, licenses, installations }: { departmentId: string; licenses: { id: string; productName: string; seats: number; usedSeats: number }[]; installations: { id: string; productName: string; assetTag: string }[] }) {
  const action = assignLicenseSeatAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Lisans</label>
        <select name="licenseId" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {licenses.map((l) => <option key={l.id} value={l.id}>{l.productName} ({l.usedSeats}/{l.seats})</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kurulum (lisanssız)</label>
        <select name="installationId" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {installations.map((i) => <option key={i.id} value={i.id}>{i.productName} — {i.assetTag}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Koltuk Ata'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
