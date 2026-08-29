'use client';

import { useActionState } from 'react';
import { createDiagramAction, type FormState } from '@/actions/it/network-diagram';

export function DiagramForm({ departmentId }: { departmentId: string }) {
  const action = createDiagramAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Diyagram Adı</label><input name="name" required style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Diyagram Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
