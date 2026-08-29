'use client';

import { useActionState } from 'react';
import { transitionTicketAction, type FormState } from '@/actions/it/tickets';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni', TRIAGED: 'Triyaj Edildi', ASSIGNED: 'Atandı', ACCEPTED: 'Kabul Edildi',
  ON_THE_WAY: 'Yolda', ARRIVED: 'Vardı', INSPECTION: 'İnceleme', WORKING: 'Çalışılıyor',
  WAITING: 'Beklemede', TESTING: 'Test Ediliyor', RESOLVED: 'Çözüldü',
  USER_APPROVAL_PENDING: 'Kullanıcı Onayı Bekliyor', CLOSED: 'Kapatıldı'
};

export function TicketTransitionForm({ departmentId, ticketId, nextStatuses }: { departmentId: string; ticketId: string; nextStatuses: string[] }) {
  const action = transitionTicketAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (nextStatuses.length === 0) return null;

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <select name="toStatus" required style={{ padding: 6 }}>
        {nextStatuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
      </select>
      <input name="note" placeholder="Not (opsiyonel)" style={{ padding: 6, flex: 1, minWidth: 160 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Durumu Değiştir'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
