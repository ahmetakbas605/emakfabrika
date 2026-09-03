'use client';

import { useActionState, useState } from 'react';
import {
  archiveOccupationalHealthRecordAction,
  createOccupationalHealthRecordAction,
  type FormState
} from '@/actions/hr-occupational-health';

const FIELD: React.CSSProperties = { padding: 8, minWidth: 150 };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 };

export function OccupationalHealthForm({
  departmentId,
  employees
}: {
  departmentId: string;
  employees: { id: string; firstName: string; lastName: string }[];
}) {
  const action = createOccupationalHealthRecordAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  // İki alan KOŞULLU zorunlu (sunucu tarafında da doğrulanıyor,
  // lib/hr/occupational-health.ts): periyodik takipte sonraki tarih,
  // "kısıtlı uygun" kararında kısıtlama metni. Formda da göstermek,
  // kullanıcıyı sunucuya gidip hata almadan uyarır.
  const [recordType, setRecordType] = useState('EXAMINATION');
  const [result, setResult] = useState('PENDING');
  const needsNextDue = recordType === 'PERIODIC_FOLLOWUP';
  const needsRestriction = result === 'FIT_WITH_RESTRICTION';

  return (
    <form
      action={formAction}
      className="dim-card"
      style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: 16, marginBottom: 20 }}
    >
      <div>
        <label style={LABEL}>Çalışan</label>
        <select name="employeeId" required style={FIELD}>
          <option value="">Seçiniz</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={LABEL}>Kayıt Türü</label>
        <select name="recordType" required style={FIELD} value={recordType} onChange={(e) => setRecordType(e.target.value)}>
          <option value="EXAMINATION">Muayene</option>
          <option value="HEALTH_REPORT">Sağlık Raporu</option>
          <option value="PERIODIC_FOLLOWUP">Periyodik Takip</option>
        </select>
      </div>

      <div>
        <label style={LABEL}>Muayene Sebebi</label>
        <select name="examKind" style={FIELD} defaultValue="PERIODIC">
          <option value="PRE_EMPLOYMENT">İşe Giriş</option>
          <option value="PERIODIC">Periyodik</option>
          <option value="RETURN_TO_WORK">İşe Dönüş</option>
          <option value="JOB_CHANGE">Görev Değişikliği</option>
          <option value="COMPLAINT">Şikâyet Üzerine</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>

      <div>
        <label style={LABEL}>Başlık</label>
        <input name="title" required style={{ ...FIELD, minWidth: 200 }} placeholder="Yıllık periyodik muayene" />
      </div>

      <div>
        <label style={LABEL}>Hekim</label>
        <input name="physicianName" style={FIELD} placeholder="Dr. Ad Soyad" />
      </div>

      <div>
        <label style={LABEL}>Kurum</label>
        <input name="institution" style={FIELD} placeholder="OSGB / Hastane" />
      </div>

      <div>
        <label style={LABEL}>Muayene Tarihi</label>
        <input name="performedAt" type="date" style={FIELD} />
      </div>

      <div>
        <label style={LABEL}>Sonraki Tarih{needsNextDue ? ' (zorunlu)' : ''}</label>
        <input name="nextDueDate" type="date" required={needsNextDue} style={FIELD} />
      </div>

      <div>
        <label style={LABEL}>Sonuç</label>
        <select name="result" style={FIELD} value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="PENDING">Beklemede</option>
          <option value="FIT">Uygun</option>
          <option value="FIT_WITH_RESTRICTION">Kısıtlı Uygun</option>
          <option value="TEMPORARILY_UNFIT">Geçici Uygun Değil</option>
          <option value="UNFIT">Uygun Değil</option>
        </select>
      </div>

      {needsRestriction ? (
        <div style={{ flex: '1 1 100%' }}>
          <label style={LABEL}>Kısıtlama (zorunlu)</label>
          <input
            name="restrictionNote"
            required
            style={{ ...FIELD, width: '100%' }}
            placeholder="Örn. yüksekte çalışamaz, gece vardiyası verilemez"
          />
        </div>
      ) : (
        <input type="hidden" name="restrictionNote" value="" />
      )}

      <div style={{ flex: '1 1 100%' }}>
        <label style={LABEL}>Not</label>
        <input name="notes" style={{ ...FIELD, width: '100%' }} placeholder="Serbest not" />
      </div>

      <button type="submit" disabled={pending}>{pending ? 'Kaydediliyor...' : 'Kayıt Ekle'}</button>

      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ArchiveRecordForm({ departmentId, recordId }: { departmentId: string; recordId: string }) {
  const action = archiveOccupationalHealthRecordAction.bind(null, departmentId, recordId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} style={{ padding: '4px 12px', fontSize: 12 }}>
        {pending ? '...' : 'Arşivle'}
      </button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
