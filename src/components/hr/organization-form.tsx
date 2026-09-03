'use client';

import { useActionState } from 'react';
import { updateEmployeeOrganizationAction, type FormState } from '@/actions/hr-employees';

export function OrganizationForm({ departmentId, employeeId, departments, positions, employees, costCenters, current }: {
  departmentId: string;
  employeeId: string;
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  employees: { id: string; firstName: string; lastName: string }[];
  costCenters: { id: string; name: string }[];
  current: { departmentId: string | null; positionId: string | null; managerEmployeeId: string | null; costCenterId: string | null; workLocation: string };
}) {
  const action = updateEmployeeOrganizationAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Departman</label>
        <select name="employeeDepartmentId" defaultValue={current.departmentId ?? ''} style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Pozisyon</label>
        <select name="positionId" defaultValue={current.positionId ?? ''} style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Yönetici</label>
        <select name="managerEmployeeId" defaultValue={current.managerEmployeeId ?? ''} style={{ padding: 6, width: 160 }}>
          <option value="">Seçiniz</option>
          {employees.filter((e) => e.id !== employeeId).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Masraf Merkezi</label>
        <select name="costCenterId" defaultValue={current.costCenterId ?? ''} style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Çalışma Yeri</label>
        <input name="workLocation" defaultValue={current.workLocation} style={{ padding: 6, width: 140 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
