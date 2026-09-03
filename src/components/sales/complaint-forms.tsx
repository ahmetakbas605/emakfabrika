'use client';

import { useActionState } from 'react';
import { createComplaintAction, updateComplaintStatusAction, resolveComplaintAction, type FormState } from '@/actions/sales-complaints';

export function CreateComplaintForm({ parties }: { parties: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createComplaintAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Cari</label>
        <select name="partyId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Konu</label><input name="subject" required style={{ padding: 6, width: 200 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Öncelik</label>
        <select name="priority" style={{ padding: 6 }}>
          <option value="LOW">Düşük</option><option value="MEDIUM">Orta</option><option value="HIGH">Yüksek</option><option value="CRITICAL">Kritik</option>
        </select>
      </div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama</label><textarea name="description" required rows={2} style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Şikayet Kaydet'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ComplaintStatusButtons({ complaintId, currentStatus }: { complaintId: string; currentStatus: string }) {
  const [statusState, statusAction, statusPending] = useActionState<FormState, FormData>(updateComplaintStatusAction, undefined);
  const [resolveState, resolveAction, resolvePending] = useActionState<FormState, FormData>(resolveComplaintAction, undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <form action={statusAction} style={{ display: 'inline-flex', gap: 4 }}>
        <input type="hidden" name="complaintId" value={complaintId} />
        <select name="status" defaultValue={currentStatus === 'RESOLVED' ? 'CLOSED' : currentStatus} style={{ padding: '2px 4px', fontSize: 12 }}>
          <option value="OPEN">Açık</option><option value="IN_PROGRESS">İşleniyor</option><option value="CLOSED">Kapat</option>
        </select>
        <button type="submit" disabled={statusPending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{statusPending ? '...' : 'Güncelle'}</button>
      </form>
      <form action={resolveAction} style={{ display: 'inline-flex', gap: 4 }}>
        <input type="hidden" name="complaintId" value={complaintId} />
        <input name="resolutionNote" placeholder="Çözüm notu" style={{ padding: '2px 4px', fontSize: 12, width: 140 }} />
        <button type="submit" disabled={resolvePending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{resolvePending ? '...' : 'Çözümlendi'}</button>
      </form>
      {statusState?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{statusState.error}</span> : null}
      {resolveState?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{resolveState.error}</span> : null}
    </div>
  );
}
