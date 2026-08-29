'use client';

import { useActionState } from 'react';
import { reopenTicketAction, type FormState } from '@/actions/it/tickets';

export function ReopenTicketForm({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = reopenTicketAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input name="note" placeholder="Yeniden açma nedeni (opsiyonel)" style={{ padding: 6, flex: 1, minWidth: 200 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Yeniden Aç'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
