'use client';

import { useActionState } from 'react';
import { createChangeAction, type FormState } from '@/actions/it/changes';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function ChangeForm({ departmentId }: { departmentId: string }) {
  const action = createChangeAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6, maxWidth: 480 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label>
        <input name="title" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama</label>
        <textarea name="description" rows={2} style={{ padding: 6, width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Risk Seviyesi</label>
          <select name="riskLevel" required style={{ padding: 6, width: '100%' }}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Etki Seviyesi</label>
          <select name="impactLevel" required style={{ padding: 6, width: '100%' }}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Planlanan Tarih (opsiyonel)</label>
        <input name="scheduledAt" type="datetime-local" style={{ padding: 6, width: '100%' }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Değişiklik Talebi Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
