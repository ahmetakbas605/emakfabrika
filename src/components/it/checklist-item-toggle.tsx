'use client';

import { useActionState } from 'react';
import { toggleChecklistItemAction, type FormState } from '@/actions/it/field-service';

export function ChecklistItemToggle({ departmentId, workOrderId, itemId, label, checked }: { departmentId: string; workOrderId: string; itemId: string; label: string; checked: boolean }) {
  const action = toggleChecklistItemAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
        <input type="checkbox" name="checked" defaultChecked={checked} onChange={(e) => e.currentTarget.form?.requestSubmit()} disabled={pending} />
        {label}
      </label>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
