'use client';

import { useActionState } from 'react';
import { createWorkOrderAction, type FormState } from '@/actions/it/field-service';

export function WorkOrderForm({ departmentId, tickets }: { departmentId: string; tickets: { id: string; ticketNo: string; title: string }[] }) {
  const action = createWorkOrderAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (tickets.length === 0) return <p style={{ color: '#999', fontSize: 13 }}>Work order açılabilecek (saha işi tipinde, henüz açılmamış) bir ticket yok.</p>;

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Saha İşi Ticket</label>
        <select name="ticketId" required style={{ padding: 6, minWidth: 220 }}>
          <option value="">Seçin...</option>
          {tickets.map((t) => <option key={t.id} value={t.id}>{t.ticketNo} — {t.title}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Work Order Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
