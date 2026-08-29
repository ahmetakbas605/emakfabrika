'use client';

import { useActionState } from 'react';
import { createMaintenancePlanAction, type FormState } from '@/actions/it/maintenance';

export function MaintenancePlanForm({
  departmentId, assets, users, checklistTemplates
}: {
  departmentId: string;
  assets: { id: string; assetTag: string; name: string }[];
  users: { id: string; fullName: string }[];
  checklistTemplates: { id: string; name: string }[];
}) {
  const action = createMaintenancePlanAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #ddd', padding: 12, borderRadius: 6, maxWidth: 520 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlık</label>
        <input name="title" required style={{ padding: 6, width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık (opsiyonel — boşsa genel/lokasyon bazlı)</label>
          <select name="assetId" style={{ padding: 6, width: '100%' }}>
            <option value="">Seçilmedi</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bakım Tipi</label>
          <select name="maintenanceType" required style={{ padding: 6, width: '100%' }}>
            <option value="PREVENTIVE">Önleyici</option>
            <option value="CORRECTIVE">Düzeltici</option>
            <option value="PREDICTIVE">Kestirimci</option>
            <option value="INSPECTION">Denetim</option>
            <option value="CALIBRATION">Kalibrasyon</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sıklık</label>
          <select name="frequency" required style={{ padding: 6, width: '100%' }}>
            <option value="DAILY">Günlük</option>
            <option value="WEEKLY">Haftalık</option>
            <option value="MONTHLY">Aylık</option>
            <option value="QUARTERLY">3 Aylık</option>
            <option value="ANNUAL">Yıllık</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Aralık</label>
          <input name="intervalValue" type="number" min={1} defaultValue={1} style={{ padding: 6, width: 70 }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç Tarihi</label>
        <input name="startDate" type="date" required style={{ padding: 6 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Teknisyen (opsiyonel)</label>
          <select name="assignedTechnicianId" style={{ padding: 6, width: '100%' }}>
            <option value="">Seçilmedi</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Checklist Şablonu (opsiyonel)</label>
          <select name="checklistTemplateId" style={{ padding: 6, width: '100%' }}>
            <option value="">Seçilmedi</option>
            {checklistTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Bakım Planı Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
