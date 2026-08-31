'use client';

import { useActionState } from 'react';
import { createIncidentAction, startIncidentInvestigationAction, closeIncidentAction, type FormState } from '@/actions/safety';

export function CreateIncidentForm({ employees }: { employees: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createIncidentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="incidentType" required style={{ padding: 6 }}>
          <option value="ACCIDENT">Kaza</option>
          <option value="NEAR_MISS">Ramak Kala</option>
          <option value="OCCUPATIONAL_ILLNESS">Meslek Hastalığı</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Önem</label>
        <select name="severity" style={{ padding: 6 }}>
          <option value="MINOR">Hafif</option>
          <option value="MODERATE">Orta</option>
          <option value="SEVERE">Ağır</option>
          <option value="FATAL">Ölümcül</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="incidentDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yer (ops.)</label><input name="location" style={{ padding: 6, width: 140 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan (ops.)</label>
        <select name="employeeId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
        </select>
      </div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label><input name="description" required style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Olay Kaydı Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function StartIncidentInvestigationButton({ incidentId }: { incidentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startIncidentInvestigationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="incidentId" value={incidentId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Soruşturmayı Başlat'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CloseIncidentForm({ incidentId }: { incidentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeIncidentAction, undefined);
  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="incidentId" value={incidentId} />
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Kök Neden</label>
      <textarea name="rootCause" required rows={2} style={{ width: '100%', padding: 6, marginBottom: 8 }} />
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Düzeltici Faaliyet</label>
      <textarea name="correctiveAction" required rows={2} style={{ width: '100%', padding: 6, marginBottom: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kapat'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
    </form>
  );
}
