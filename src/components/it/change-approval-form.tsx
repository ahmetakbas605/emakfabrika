'use client';

import { useActionState } from 'react';
import { recordApprovalAction, scheduleChangeAction, type FormState } from '@/actions/it/changes';

export function ChangeApprovalForm({ departmentId, changeId, canApprove, canSchedule }: { departmentId: string; changeId: string; canApprove: boolean; canSchedule: boolean }) {
  const approveAction = recordApprovalAction.bind(null, departmentId);
  const [approveState, approveFormAction, approvePending] = useActionState<FormState, FormData>(approveAction, undefined);
  const scheduleAction = scheduleChangeAction.bind(null, departmentId);
  const [scheduleState, scheduleFormAction, schedulePending] = useActionState<FormState, FormData>(scheduleAction, undefined);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {canApprove ? (
        <form action={approveFormAction} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="hidden" name="changeId" value={changeId} />
          <button type="submit" name="decision" value="APPROVED" disabled={approvePending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>Onayla</button>
          <button type="submit" name="decision" value="REJECTED" disabled={approvePending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>Reddet</button>
        </form>
      ) : null}
      {canSchedule ? (
        <form action={scheduleFormAction}>
          <input type="hidden" name="changeId" value={changeId} />
          <button type="submit" disabled={schedulePending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>Planla</button>
        </form>
      ) : null}
      {approveState?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{approveState.error}</span> : null}
      {scheduleState?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{scheduleState.error}</span> : null}
    </div>
  );
}
