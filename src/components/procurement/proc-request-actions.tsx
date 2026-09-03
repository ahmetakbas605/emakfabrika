'use client';

import { useActionState } from 'react';
import { submitProcRequestAction, cancelProcRequestAction, updateLineStockStatusAction, addProcRequestLineAttachmentAction, type FormState } from '@/actions/procurement';

export function SubmitRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitProcRequestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Onaya Gönder'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelProcRequestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

const STOCK_STATUS_LABEL: Record<string, string> = { PENDING: 'Bekliyor', STOCK_AVAILABLE: 'Stokta Var', STOCK_PARTIAL: 'Kısmen Var', STOCK_UNAVAILABLE: 'Stokta Yok', NEW_PURCHASE_REQUIRED: 'Satınalma Gerekli' };

export function LineStockStatusForm({ requestId, lineId, currentStatus }: { requestId: string; lineId: string; currentStatus: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateLineStockStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="lineId" value={lineId} />
      <select name="stockStatus" defaultValue={currentStatus} style={{ padding: 3, fontSize: 11 }}>
        {Object.entries(STOCK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}>{pending ? '...' : 'Düzelt'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 10 }}>{state.error}</span> : null}
    </form>
  );
}

export function LineAttachmentForm({ requestId, lineId }: { requestId: string; lineId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addProcRequestLineAttachmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="lineId" value={lineId} />
      <input type="file" name="file" required style={{ fontSize: 11 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 10 }}>{state.error}</span> : null}
    </form>
  );
}
