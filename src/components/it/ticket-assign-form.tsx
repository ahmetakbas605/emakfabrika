'use client';

import { useActionState } from 'react';
import { assignTicketAction, type FormState } from '@/actions/it/tickets';

export function TicketAssignForm({ departmentId, ticketId, users }: { departmentId: string; ticketId: string; users: { id: string; fullName: string }[] }) {
  const action = assignTicketAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <select name="userId" required style={{ padding: 6 }}>
        <option value="">Kullanıcı...</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
      </select>
      <select name="role" style={{ padding: 6 }}>
        <option value="LEADER">Sorumlu (Leader)</option>
        <option value="MEMBER">Yardımcı (Member)</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Ata'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
