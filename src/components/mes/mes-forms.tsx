'use client';

import { useActionState } from 'react';
import { createMachineAction, recordDowntimeStartAction, recordDowntimeEndAction, type FormState } from '@/actions/mes';

export function CreateMachineForm({ workCenters }: { workCenters: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createMachineAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İş Merkezi</label>
        <select name="workCenterId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {workCenters.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>İdeal Çevrim Süresi (sn/adet, ops.)</label><input name="idealCycleTimeSeconds" type="number" step="0.01" style={{ padding: 6, width: 110 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Makine Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function StartDowntimeForm({ machines, reasons }: { machines: { id: string; code: string; name: string }[]; reasons: { code: string; name: string; category: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordDowntimeStartAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Makine</label>
        <select name="machineId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Neden</label>
        <select name="reasonCode" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {reasons.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.category === 'PLANNED' ? 'Planlı' : 'Plansız'})</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Not (ops.)</label><input name="notes" style={{ padding: 6, width: 160 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Duruş Başlat'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function EndDowntimeButton({ downtimeId }: { downtimeId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordDowntimeEndAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="downtimeId" value={downtimeId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Duruşu Kapat'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
