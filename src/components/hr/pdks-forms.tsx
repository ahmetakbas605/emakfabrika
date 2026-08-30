'use client';

import { useActionState } from 'react';
import { createShiftAction, assignEmployeeShiftAction, createDeviceAction, recordManualPunchAction, processAttendanceAction, type FormState } from '@/actions/hr-pdks';

export function ShiftForm({ departmentId }: { departmentId: string }) {
  const action = createShiftAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 90 }} placeholder="GUNDUZ" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 140 }} placeholder="Gündüz Vardiyası" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="startTime" type="time" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="endTime" type="time" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Mola (dk)</label><input name="breakMinutes" type="number" min={0} style={{ padding: 6, width: 70 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tolerans (dk)</label><input name="graceMinutes" type="number" min={0} style={{ padding: 6, width: 70 }} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666' }}><input name="crossesMidnight" type="checkbox" /> Gece vardiyası</label>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Vardiya Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function AssignShiftForm({ departmentId, employees, shiftOptions }: { departmentId: string; employees: { id: string; firstName: string; lastName: string }[]; shiftOptions: { id: string; name: string }[] }) {
  const action = assignEmployeeShiftAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}>
          <option value="">Seçiniz</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Vardiya</label>
        <select name="shiftId" style={{ padding: 6, width: 150 }}>
          <option value="">Yok</option>
          {shiftOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ata'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function DeviceForm({ departmentId }: { departmentId: string }) {
  const action = createDeviceAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} placeholder="GIRIS-01" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 160 }} placeholder="Ana Giriş Turnikesi" /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Adaptör</label>
        <select name="adapterType" style={{ padding: 6, width: 140 }}>
          <option value="MANUAL">Manuel (test/backfill)</option>
          <option value="GENERIC_RFID">Genel RFID</option>
          <option value="ZKTECO">ZKTeco</option>
          <option value="HIKVISION">Hikvision</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Cihaz Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ManualPunchForm({ departmentId, employees, manualDevices }: { departmentId: string; employees: { id: string; firstName: string; lastName: string }[]; manualDevices: { id: string; name: string }[] }) {
  const action = recordManualPunchAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Cihaz (Manuel)</label>
        <select name="deviceId" required style={{ padding: 6, width: 160 }}>
          <option value="">Seçiniz</option>
          {manualDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}>
          <option value="">Seçiniz</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih/Saat</label><input name="punchAt" type="datetime-local" required style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yön</label>
        <select name="direction" style={{ padding: 6, width: 100 }}>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
          <option value="UNKNOWN">Belirsiz</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kayıt Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ProcessAttendanceForm({ departmentId, employees, defaultDate }: { departmentId: string; employees: { id: string; firstName: string; lastName: string }[]; defaultDate: string }) {
  const action = processAttendanceAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}>
          <option value="">Seçiniz</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="workDate" type="date" required defaultValue={defaultDate} style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'İşleniyor...' : 'Yoklamayı İşle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
