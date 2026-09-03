'use client';

import { useActionState } from 'react';
import { createEmployeeQualificationAction, revokeEmployeeQualificationAction, type FormState } from '@/actions/hr-qualifications';

const QUALIFICATION_TYPE_LABELS: Record<string, string> = { DIPLOMA: 'Diploma', CERTIFICATE: 'Sertifika', TRAINING: 'Eğitim', LICENSE: 'Lisans', OTHER: 'Diğer' };

export function QualificationForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = createEmployeeQualificationAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="qualificationType" required style={{ padding: 6, width: 130 }}>
          {Object.entries(QUALIFICATION_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required placeholder="İş Güvenliği Sertifikası" style={{ padding: 6, width: 200 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Veren Kurum</label>
        <input name="institution" style={{ padding: 6, width: 160 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bölüm / Alan</label>
        <input name="fieldOfStudy" style={{ padding: 6, width: 140 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Belge No</label>
        <input name="credentialNumber" style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Veriliş Tarihi</label>
        <input name="issueDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Geçerlilik Tarihi</label>
        <input name="expiryDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Belge Dosyası (opsiyonel)</label>
        <input name="file" type="file" style={{ padding: 4 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function RevokeQualificationButton({ departmentId, employeeId, qualificationId }: { departmentId: string; employeeId: string; qualificationId: string }) {
  const action = revokeEmployeeQualificationAction.bind(null, departmentId, employeeId, qualificationId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline' }}>
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--dim-danger)' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
