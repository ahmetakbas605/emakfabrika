'use client';

import { useActionState } from 'react';
import { createPrototypeAction, updatePrototypeStatusAction, createLabTestAction, updateLabTestStatusAction, type FormState } from '@/actions/rnd';

export function CreatePrototypeForm({ projects }: { projects: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPrototypeAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Proje (ops.)</label>
        <select name="projectId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama (ops.)</label><input name="description" style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Prototip Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function UpdatePrototypeStatusForm({ prototypeId }: { prototypeId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePrototypeStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="prototypeId" value={prototypeId} />
      <select name="status" style={{ padding: 4, fontSize: 12 }}>
        <option value="DESIGN">Tasarım</option>
        <option value="BUILDING">Üretiliyor</option>
        <option value="TESTING">Test Ediliyor</option>
        <option value="APPROVED">Onaylandı</option>
        <option value="REJECTED">Reddedildi</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateLabTestForm({ prototypes }: { prototypes: { id: string; prototypeNo: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLabTestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Prototip (ops.)</label>
        <select name="prototypeId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {prototypes.map((p) => <option key={p.id} value={p.id}>{p.prototypeNo} — {p.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Test Adı</label><input name="testName" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tarih (ops.)</label><input name="testDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Test Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function UpdateLabTestStatusForm({ testId }: { testId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateLabTestStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="testId" value={testId} />
      <select name="status" style={{ padding: 4, fontSize: 12 }}>
        <option value="PLANNED">Planlandı</option>
        <option value="IN_PROGRESS">Devam Ediyor</option>
        <option value="COMPLETED">Tamamlandı</option>
        <option value="FAILED">Başarısız</option>
      </select>
      <input name="resultSummary" placeholder="Sonuç özeti (ops.)" style={{ padding: 4, fontSize: 12, width: 160 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
