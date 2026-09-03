'use client';

import { useActionState } from 'react';
import { setUserOrgAssignmentAction, type FormState } from '@/actions/org';

export function OrgAssignmentForm({ userId, positions, users, currentPositionId, currentManagerUserId }: {
  userId: string;
  positions: { id: string; title: string }[];
  users: { id: string; fullName: string }[];
  currentPositionId: string | null;
  currentManagerUserId: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setUserOrgAssignmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="userId" value={userId} />
      <select name="positionId" defaultValue={currentPositionId ?? ''} style={{ padding: 4, fontSize: 12 }}>
        <option value="">— pozisyon yok —</option>
        {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <select name="managerUserId" defaultValue={currentManagerUserId ?? ''} style={{ padding: 4, fontSize: 12 }}>
        <option value="">— yönetici yok —</option>
        {users.filter((u) => u.id !== userId).map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>{pending ? '...' : 'Kaydet'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
