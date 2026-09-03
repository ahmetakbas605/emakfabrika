'use client';

import { useActionState } from 'react';
import { createDepartmentAction, type FormState } from '@/actions/departments';

export function DepartmentForm({ departmentTypes, departments }: { departmentTypes: { code: string; name: string }[]; departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createDepartmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Departman Türü</label>
        <select name="departmentTypeCode" required style={{ padding: 6, width: 180 }}>
          <option value="">Seçiniz</option>
          {departmentTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 180 }} placeholder="İnsan Kaynakları" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Üst Departman</label>
        <select name="parentDepartmentId" style={{ padding: 6, width: 180 }}>
          <option value="">Yok</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Departman Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
