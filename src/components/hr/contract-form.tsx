'use client';

import { useActionState } from 'react';
import { createEmployeeContractAction, type FormState } from '@/actions/hr-contracts';

const CONTRACT_TYPE_LABELS: Record<string, string> = { INDEFINITE: 'Belirsiz Süreli', DEFINITE: 'Belirli Süreli', PART_TIME: 'Kısmi Zamanlı', INTERNSHIP: 'Stajyer', CONSULTANT: 'Danışman' };

export function ContractForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = createEmployeeContractAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sözleşme Türü</label>
        <select name="contractType" required style={{ padding: 6, width: 150 }}>
          {Object.entries(CONTRACT_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label>
        <input name="startDate" type="date" required style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label>
        <input name="endDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Deneme Süresi Bitişi</label>
        <input name="probationEndDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Haftalık Çalışma Saati</label>
        <input name="weeklyWorkingHours" type="number" step="any" min={0} style={{ padding: 6, width: 90 }} />
      </div>
      <div style={{ width: '100%' }}>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şartlar / Notlar</label>
        <textarea name="terms" rows={2} style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sözleşme Belgesi (opsiyonel)</label>
        <input name="file" type="file" style={{ padding: 4 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Yeni Sözleşme Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
