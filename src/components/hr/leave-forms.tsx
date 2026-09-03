'use client';

import { useActionState } from 'react';
import { createLeaveRequestAction, submitLeaveRequestAction, cancelLeaveRequestAction, setLeaveEntitlementAction, type FormState } from '@/actions/hr-leave';

const LEAVE_TYPE_LABELS: Record<string, string> = { ANNUAL: 'Yıllık İzin', SICK: 'Hastalık İzni', UNPAID: 'Ücretsiz İzin', ABSENCE: 'Devamsızlık (Mazeretsiz)', MATERNITY: 'Doğum İzni', PATERNITY: 'Babalık İzni', BEREAVEMENT: 'Vefat İzni', OTHER: 'Diğer' };

export function CreateLeaveForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLeaveRequestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="leaveType" required style={{ padding: 6, width: 170 }}>
          {Object.entries(LEAVE_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label><input name="startDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label><input name="endDate" type="date" required style={{ padding: 6 }} /></div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama</label><textarea name="reason" rows={2} style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Taslak Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function SubmitLeaveButton({ leaveRequestId }: { leaveRequestId: string }) {
  const action = submitLeaveRequestAction.bind(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Gönder'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelLeaveButton({ leaveRequestId }: { leaveRequestId: string }) {
  const action = cancelLeaveRequestAction.bind(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="leaveRequestId" value={leaveRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--dim-danger)' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function SetEntitlementForm({ departmentId, employees, currentYear }: { departmentId: string; employees: { id: string; firstName: string; lastName: string }[]; currentYear: number }) {
  const action = setLeaveEntitlementAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}>
          <option value="">Seçiniz</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yıl</label><input name="year" type="number" defaultValue={currentYear} style={{ padding: 6, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İzin Türü</label>
        <select name="leaveType" required style={{ padding: 6, width: 170 }}>
          {Object.entries(LEAVE_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Hak Ediş (gün)</label><input name="entitlementDays" type="number" step="0.5" min={0} style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Hak Ediş Kaydet'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export { LEAVE_TYPE_LABELS };
