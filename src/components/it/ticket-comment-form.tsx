'use client';

import { useActionState } from 'react';
import { addCommentAction, type FormState } from '@/actions/it/tickets';

export function TicketCommentForm({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = addCommentAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea name="body" placeholder="Yorum ekle..." required rows={2} style={{ padding: 6 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" name="isInternal" /> Yalnızca teknisyenler görsün
        </label>
        <button type="submit" disabled={pending} style={{ padding: '5px 10px', cursor: 'pointer' }}>{pending ? '...' : 'Yorum Ekle'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
      </div>
    </form>
  );
}
