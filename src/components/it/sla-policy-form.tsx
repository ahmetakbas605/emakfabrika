'use client';

import { useActionState } from 'react';
import { createSlaPolicyAction, type FormState } from '@/actions/it/tickets';

export function SlaPolicyForm({ departmentId }: { departmentId: string }) {
  const action = createSlaPolicyAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Öncelik</label>
        <select name="priority" required style={{ padding: 6 }}>
          <option value="LOW">LOW</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yanıt (dk)</label>
        <input name="responseMinutes" type="number" min={1} required style={{ padding: 6, width: 90 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Çözüm (saat)</label>
        <input name="resolutionHours" type="number" min={1} required style={{ padding: 6, width: 90 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Eskalasyon Zinciri (opsiyonel, rol kodları virgülle)</label>
        <input name="escalationChainText" placeholder="SERVICE_DESK_AGENT,IT_MANAGER" style={{ padding: 6, minWidth: 240 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'SLA Politikası Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
