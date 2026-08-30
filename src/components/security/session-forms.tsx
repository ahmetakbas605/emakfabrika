'use client';

import { useActionState } from 'react';
import { revokeMySessionAction, revokeAllOtherSessionsAction, adminRevokeSessionAction, type FormState } from '@/actions/security-sessions';
import { AuroraButton } from '@/components/shell/ui';

export function RevokeMySessionButton({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(revokeMySessionAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'Sonlandır'}</button>
    </form>
  );
}

export function RevokeAllOtherSessionsButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(revokeAllOtherSessionsAction, undefined);
  return (
    <form action={formAction}>
      <AuroraButton type="submit" variant="danger" disabled={pending}>{pending ? '...' : 'Diğer Tüm Oturumları Sonlandır'}</AuroraButton>
      {state?.success ? <p className="text-sm mt-2" style={{ color: 'var(--aurora-emerald)' }}>{state.success}</p> : null}
    </form>
  );
}

export function AdminRevokeSessionButton({ sessionId, userId }: { sessionId: string; userId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(adminRevokeSessionAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'İptal Et'}</button>
    </form>
  );
}
