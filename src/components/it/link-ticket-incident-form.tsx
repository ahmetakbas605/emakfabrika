'use client';

import { useActionState } from 'react';
import { linkTicketToIncidentAction, type FormState } from '@/actions/it/incidents';

export function LinkTicketIncidentForm({ departmentId, incidents, tickets }: { departmentId: string; incidents: { id: string; title: string }[]; tickets: { id: string; ticketNo: string; title: string }[] }) {
  const action = linkTicketToIncidentAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ticket</label>
        <select name="ticketId" required style={{ padding: 6, minWidth: 180 }}>
          <option value="">Seçin...</option>
          {tickets.map((t) => <option key={t.id} value={t.id}>{t.ticketNo} — {t.title}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Incident</label>
        <select name="incidentId" required style={{ padding: 6, minWidth: 180 }}>
          <option value="">Seçin...</option>
          {incidents.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bağla'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
