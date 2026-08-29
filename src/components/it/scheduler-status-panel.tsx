'use client';

import { useActionState } from 'react';
import { triggerSchedulerAction, type FormState } from '@/actions/it/scheduler';

export function SchedulerStatusPanel({
  departmentId, lastRunAt, runCount, intervalMs
}: {
  departmentId: string;
  lastRunAt: string | null;
  runCount: number;
  intervalMs: number;
}) {
  const action = triggerSchedulerAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 13, color: '#666' }}>
        Zamanlayıcı — her {Math.round(intervalMs / 1000 / 60)} dakikada bir otomatik çalışır (SLA eskalasyonu + bakım üretimi).<br />
        Son çalışma: {lastRunAt ? new Date(lastRunAt).toLocaleString('tr-TR') : 'henüz çalışmadı'} · Toplam {runCount} tur.
      </div>
      <form action={formAction}>
        <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Şimdi Çalıştır'}</button>
      </form>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12 }}>{state.success}</span> : null}
    </div>
  );
}
