'use client';

import { useActionState } from 'react';
import { createDelegationAction, deactivateDelegationAction, type FormState } from '@/actions/org';

export function DelegationForm({ users }: { users: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createDelegationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Vekil</label>
        <select name="delegateUserId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label>
        <input name="startsAt" type="datetime-local" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label>
        <input name="endsAt" type="datetime-local" required style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Vekalet Oluştur'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}

export function DeactivateDelegationButton({ delegationId }: { delegationId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(deactivateDelegationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline' }}>
      <input type="hidden" name="delegationId" value={delegationId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>{pending ? '...' : 'Kaldır'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
