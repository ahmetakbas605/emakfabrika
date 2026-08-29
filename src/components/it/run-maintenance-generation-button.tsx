'use client';

import { useActionState } from 'react';
import { runDueMaintenanceGenerationAction, type FormState } from '@/actions/it/maintenance';

// TODO: SCHEDULER_INFRASTRUCTURE bağlanana kadar bu buton, cron'un yapacağı
// işi ELLE tetikler — mantık zaten idempotent (aynı gün için iki kez
// tetiklense bile ikinci kez work order üretmez).
export function RunMaintenanceGenerationButton({ departmentId }: { departmentId: string }) {
  const action = runDueMaintenanceGenerationAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bugün İçin Bakım İşlerini Oluştur'}</button>
      {state?.success ? <span style={{ color: '#080', fontSize: 13 }}>{state.success}</span> : null}
    </form>
  );
}
