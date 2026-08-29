'use client';

import { useActionState } from 'react';
import { setContinuousLocationTrackingAction, type FormState } from '@/actions/it/field-service';

// FIELD-SERVICE.md §2 — KAPALI varsayılan, KVKK/madde 88,132. Açıkça,
// bilinçli bir yönetici işlemi olarak açılır.
export function LocationPolicyForm({ departmentId, enabled }: { departmentId: string; enabled: boolean }) {
  const action = setContinuousLocationTrackingAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" name="enabled" defaultChecked={enabled} onChange={(e) => e.currentTarget.form?.requestSubmit()} disabled={pending} />
        Sürekli konum takibini etkinleştir (varsayılan kapalı — KVKK)
      </label>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
