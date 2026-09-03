'use client';

import { useActionState } from 'react';
import { recordMetricAction, type FormState } from '@/actions/it/monitoring';

export function MetricForm({ departmentId, targets }: { departmentId: string; targets: { id: string; assetTag: string; targetType: string }[] }) {
  const action = recordMetricAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Hedef</label>
        <select name="targetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {targets.map((t) => <option key={t.id} value={t.id}>{t.assetTag} ({t.targetType})</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Metrik Adı</label><input name="metricName" placeholder="up / cpu_percent / latency_ms" required style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Değer</label><input name="value" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ölçüm Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
