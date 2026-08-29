'use client';

import { useActionState } from 'react';
import { assignAssetAction, type FormState } from '@/actions/it/assets';

export function AssignAssetForm({ departmentId, assetId, users }: { departmentId: string; assetId: string; users: { id: string; fullName: string }[] }) {
  const action = assignAssetAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="assetId" value={assetId} />
      <select name="userId" required style={{ padding: 3, fontSize: 12, maxWidth: 140 }}>
        <option value="">Kullanıcı...</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Ata'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
