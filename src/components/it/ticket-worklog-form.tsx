'use client';

import { useActionState } from 'react';
import { logWorkAction, type FormState } from '@/actions/it/tickets';

export function TicketWorkLogForm({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = logWorkAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input name="minutesSpent" type="number" min={1} placeholder="Dakika" required style={{ padding: 6, width: 90 }} />
      <input name="note" placeholder="Not (opsiyonel)" style={{ padding: 6, flex: 1, minWidth: 160 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'İş Kaydı Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
