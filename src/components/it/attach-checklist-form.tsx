'use client';

import { useActionState } from 'react';
import { attachChecklistAction, type FormState } from '@/actions/it/field-service';

export function AttachChecklistForm({ departmentId, workOrderId, templates }: { departmentId: string; workOrderId: string; templates: { id: string; name: string }[] }) {
  const action = attachChecklistAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <select name="templateId" style={{ padding: 6 }}>
        <option value="">Şablonsuz (boş checklist)</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Checklist Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
