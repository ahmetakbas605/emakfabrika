'use client';

import { useActionState } from 'react';
import {
  createVehicleAction, createVehicleInsuranceAction, createFleetMaintenancePlanAction, runFleetMaintenanceGenerationAction, recordVehicleExpenseAction, type FormState
} from '@/actions/fleet';

export function CreateVehicleForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createVehicleAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Plaka</label><input name="plateNo" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Marka</label><input name="brand" style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Model</label><input name="model" style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yıl</label><input name="year" type="number" style={{ padding: 6, width: 70 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yakıt Tipi</label>
        <select name="fuelType" style={{ padding: 6 }}>
          <option value="DIESEL">Dizel</option>
          <option value="GASOLINE">Benzin</option>
          <option value="LPG">LPG</option>
          <option value="ELECTRIC">Elektrik</option>
          <option value="HYBRID">Hibrit</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ruhsat Bitiş (ops.)</label><input name="registrationExpiryDate" type="date" style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sorumlu Departman (ops.)</label>
        <select name="departmentId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Araç Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateVehicleInsuranceForm({ vehicles }: { vehicles: { id: string; plateNo: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createVehicleInsuranceAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Araç</label>
        <select name="vehicleId" required style={{ padding: 6, minWidth: 100 }}>
          <option value="">Seçin</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNo}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Poliçe No</label><input name="policyNo" required style={{ padding: 6, width: 120 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şirket</label><input name="provider" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kapsam (Trafik/Kasko)</label><input name="coverageType" style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="startDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="endDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Prim (ops.)</label><input name="premium" type="number" step="0.01" style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Poliçe Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateFleetMaintenancePlanForm({ vehicles, departments }: { vehicles: { id: string; plateNo: string }[]; departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createFleetMaintenancePlanAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Araç</label>
        <select name="vehicleId" required style={{ padding: 6, minWidth: 100 }}>
          <option value="">Seçin</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNo}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sorumlu Departman</label>
        <select name="departmentId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlık</label><input name="title" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bakım Tipi</label>
        <select name="maintenanceType" required style={{ padding: 6 }}>
          <option value="PREVENTIVE">Önleyici</option>
          <option value="CORRECTIVE">Düzeltici</option>
          <option value="PREDICTIVE">Kestirimci</option>
          <option value="INSPECTION">Muayene</option>
          <option value="CALIBRATION">Kalibrasyon</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sıklık</label>
        <select name="frequency" required style={{ padding: 6 }}>
          <option value="DAILY">Günlük</option>
          <option value="WEEKLY">Haftalık</option>
          <option value="MONTHLY">Aylık</option>
          <option value="QUARTERLY">3 Aylık</option>
          <option value="ANNUAL">Yıllık</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Aralık</label><input name="intervalValue" type="number" min="1" defaultValue="1" style={{ padding: 6, width: 60 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="startDate" type="date" required style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Plan Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function RunFleetMaintenanceGenerationButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(runFleetMaintenanceGenerationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bugün İçin Bakım İşlerini Oluştur'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 6 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 6 }}>{state.success}</span> : null}
    </form>
  );
}

export function RecordVehicleExpenseForm({ vehicles }: { vehicles: { id: string; plateNo: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordVehicleExpenseAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Araç</label>
        <select name="vehicleId" required style={{ padding: 6, minWidth: 100 }}>
          <option value="">Seçin</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNo}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Gider Tipi</label>
        <select name="expenseType" required style={{ padding: 6 }}>
          <option value="FUEL">Yakıt</option>
          <option value="HGS">HGS</option>
          <option value="TOLL">Köprü/Otoyol</option>
          <option value="WASH">Yıkama</option>
          <option value="PARKING">Otopark</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="expenseDate" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tutar</label><input name="amount" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Litre (yakıt, ops.)</label><input name="quantity" type="number" step="0.01" style={{ padding: 6, width: 80 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kilometre (ops.)</label><input name="odometerKm" type="number" step="0.1" style={{ padding: 6, width: 90 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Gider Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
