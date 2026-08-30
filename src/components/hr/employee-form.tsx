'use client';

import { useActionState } from 'react';
import { createEmployeeAction, type FormState } from '@/actions/hr-employees';

export function EmployeeForm({ departmentId, departments, positions, employees, costCenters }: {
  departmentId: string;
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  employees: { id: string; firstName: string; lastName: string }[];
  costCenters: { id: string; name: string }[];
}) {
  const action = createEmployeeAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="firstName" required style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Soyad</label>
        <input name="lastName" required style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Doğum Tarihi</label>
        <input name="birthDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İşe Giriş Tarihi</label>
        <input name="hireDate" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Departman</label>
        <select name="employeeDepartmentId" style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Pozisyon</label>
        <select name="positionId" style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yönetici</label>
        <select name="managerEmployeeId" style={{ padding: 6, width: 160 }}>
          <option value="">Seçiniz</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Masraf Merkezi</label>
        <select name="costCenterId" style={{ padding: 6, width: 150 }}>
          <option value="">Seçiniz</option>
          {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışma Yeri</label>
        <input name="workLocation" style={{ padding: 6, width: 140 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Çalışan Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
