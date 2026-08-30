'use client';

import { useActionState } from 'react';
import { createOvertimeRequestAction, submitOvertimeRequestAction, cancelOvertimeRequestAction, type FormState } from '@/actions/hr-overtime';

export function CreateOvertimeForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createOvertimeRequestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="workDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Saat</label><input name="hours" type="number" step="0.5" min={0.5} required style={{ padding: 6, width: 90 }} /></div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label><textarea name="reason" rows={2} style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Taslak Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function SubmitOvertimeButton({ overtimeRequestId }: { overtimeRequestId: string }) {
  const action = submitOvertimeRequestAction.bind(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="overtimeRequestId" value={overtimeRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelOvertimeButton({ overtimeRequestId }: { overtimeRequestId: string }) {
  const action = cancelOvertimeRequestAction.bind(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="overtimeRequestId" value={overtimeRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
