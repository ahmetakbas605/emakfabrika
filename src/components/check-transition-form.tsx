'use client';

import { useActionState } from 'react';
import { transitionCheckAction, type FormState } from '@/actions/checks';

const RECEIVED_TRANSITIONS: Record<string, string[]> = { PORTFOLIO: ['COLLECTED', 'ENDORSED', 'BOUNCED', 'RETURNED'] };
const ISSUED_TRANSITIONS: Record<string, string[]> = { DRAFTED: ['DELIVERED', 'CANCELLED'], DELIVERED: ['PAID', 'CANCELLED'] };
const STATUS_LABELS: Record<string, string> = {
  COLLECTED: 'Tahsil Edildi', ENDORSED: 'Ciro Edildi', BOUNCED: 'Karşılıksız', RETURNED: 'İade Edildi',
  DELIVERED: 'Teslim Edildi', PAID: 'Ödendi', CANCELLED: 'İptal Edildi'
};

export function CheckTransitionForm({
  departmentId,
  checkId,
  direction,
  status,
  accounts
}: {
  departmentId: string;
  checkId: string;
  direction: 'RECEIVED' | 'ISSUED';
  status: string;
  accounts: { code: string; name: string }[];
}) {
  const action = transitionCheckAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const options = (direction === 'RECEIVED' ? RECEIVED_TRANSITIONS : ISSUED_TRANSITIONS)[status] ?? [];
  if (options.length === 0) return <span style={{ color: 'var(--dim-slate)', fontSize: 12 }}>—</span>;

  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="checkId" value={checkId} />
      <select name="toStatus" style={{ padding: 3, fontSize: 12 }}>
        {options.map((o) => <option key={o} value={o}>{STATUS_LABELS[o]}</option>)}
      </select>
      <select name="counterAccountCode" required style={{ padding: 3, fontSize: 12, maxWidth: 140 }}>
        <option value="">Karşı hesap...</option>
        {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Uygula'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
