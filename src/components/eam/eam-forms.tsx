'use client';

import { useActionState } from 'react';
import {
  createEamAssetAction, createEamMaintenancePlanAction, runEamMaintenanceGenerationAction, createEnergyMeterAction, recordEnergyReadingAction, createLocationAction, type FormState
} from '@/actions/eam';

export function CreateEamAssetForm({ assetTypes, branches, locations, departments }: {
  assetTypes: { code: string; name: string }[]; branches: { id: string; name: string }[]; locations: { id: string; name: string; locationType: string }[]; departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEamAssetAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ekipman Tipi</label>
        <select name="assetTypeCode" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {assetTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şube (ops.)</label>
        <select name="branchId" style={{ padding: 6, minWidth: 120 }}>
          <option value="">Seçin</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Konum (Bina/Kat, ops.)</label>
        <select name="locationId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Konum Notu (ops.)</label><input name="locationNote" style={{ padding: 6, width: 160 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sorumlu Departman (ops.)</label>
        <select name="departmentId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ekipman Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateEamMaintenancePlanForm({ assets, departments }: { assets: { id: string; code: string; name: string }[]; departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEamMaintenancePlanAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ekipman</label>
        <select name="eamAssetId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
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

export function RunEamMaintenanceGenerationButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(runEamMaintenanceGenerationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bugün İçin Bakım İşlerini Oluştur'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 6 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 6 }}>{state.success}</span> : null}
    </form>
  );
}

export function CreateEnergyMeterForm({ workCenters, assets }: { workCenters: { id: string; code: string; name: string }[]; assets: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEnergyMeterAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 160 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Enerji Tipi</label>
        <select name="energyType" required style={{ padding: 6 }}>
          <option value="ELECTRICITY">Elektrik</option>
          <option value="NATURAL_GAS">Doğalgaz</option>
          <option value="WATER">Su</option>
          <option value="STEAM">Buhar</option>
          <option value="COMPRESSED_AIR">Basınçlı Hava</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim</label><input name="unit" placeholder="kWh, m³..." required style={{ padding: 6, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İş Merkezi (ops. — ürün-başı hesap için)</label>
        <select name="workCenterId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {workCenters.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ekipman (ops.)</label>
        <select name="eamAssetId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Sayaç Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function RecordEnergyReadingForm({ meters }: { meters: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordEnergyReadingAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sayaç</label>
        <select name="meterId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {meters.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dönem Başlangıcı</label><input name="periodStart" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dönem Bitişi</label><input name="periodEnd" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tüketim</label><input name="consumption" type="number" step="0.01" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maliyet (ops.)</label><input name="cost" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Tüketim Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateLocationForm({ branches, locations }: { branches: { id: string; name: string }[]; locations: { id: string; name: string; locationType: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLocationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="locationType" required style={{ padding: 6 }}>
          <option value="BUILDING">Bina</option>
          <option value="FLOOR">Kat</option>
          <option value="ROOM">Oda</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 160 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şube (ops.)</label>
        <select name="branchId" style={{ padding: 6, minWidth: 120 }}>
          <option value="">Seçin</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üst Konum (ops. — ör. Kat için Bina)</label>
        <select name="parentLocationId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Konum Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
