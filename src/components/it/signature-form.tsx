'use client';

import { useActionState } from 'react';
import { recordSignatureAction, type FormState } from '@/actions/it/field-service';

export function SignatureForm({ departmentId, workOrderId }: { departmentId: string; workOrderId: string }) {
  const action = recordSignatureAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #ddd', padding: 12, borderRadius: 6, maxWidth: 420 }}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Müşteri Adı</label>
        <input name="customerName" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Onay Notu (imza yerine — dijital imza altyapısı henüz yok)</label>
        <textarea name="signatureNote" required rows={2} placeholder="ör. 'İşi kabul ediyorum, iş tamamlandı.'" style={{ padding: 6, width: '100%' }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Müşteri Onayını Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
