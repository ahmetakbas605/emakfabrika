'use client';

import { useActionState } from 'react';
import { transitionStockTransferAction, type FormState } from '@/actions/warehouse';

const TRANSFER_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', REQUESTED: 'Talep Edildi', APPROVED: 'Onaylandı', IN_TRANSIT: 'Yolda', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal' };

export function StockTransferTransitionForm({ departmentId, transferId, nextStatuses }: { departmentId: string; transferId: string; nextStatuses: string[] }) {
  const action = transitionStockTransferAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (nextStatuses.length === 0) return null;

  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="transferId" value={transferId} />
      {nextStatuses.map((s) => (
        <button key={s} type="submit" name="toStatus" value={s} disabled={pending} style={{ padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
          {TRANSFER_STATUS_LABEL[s] ?? s}
        </button>
      ))}
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
