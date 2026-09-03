import { requireDepartmentAccess } from '@/lib/dal';
import { listEmployees } from '@/lib/hr/employees';
import { listShifts } from '@/lib/hr/shifts';
import { listDevices, listRawPunchesForDate, listAttendanceRecords } from '@/lib/hr/pdks';
import { ShiftForm, AssignShiftForm, DeviceForm, ManualPunchForm, ProcessAttendanceForm } from '@/components/hr/pdks-forms';

const ADAPTER_LABELS: Record<string, string> = { MANUAL: 'Manuel', GENERIC_RFID: 'Genel RFID', ZKTECO: 'ZKTeco', HIKVISION: 'Hikvision' };
const DIRECTION_LABELS: Record<string, string> = { IN: 'Giriş', OUT: 'Çıkış', UNKNOWN: 'Belirsiz' };
const STATUS_LABELS: Record<string, string> = { PRESENT: 'Zamanında', LATE: 'Geç', INCOMPLETE: 'Eksik', ABSENT: 'Devamsız' };

function formatTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default async function PdksPage({ params, searchParams }: { params: Promise<{ departmentId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const { date } = await searchParams;
  const workDate = date || new Date().toISOString().slice(0, 10);

  const [employees, shiftList, devices, rawPunches, attendanceRecords] = await Promise.all([
    listEmployees(session.companyId),
    listShifts(session.companyId),
    listDevices(session.companyId),
    listRawPunchesForDate(session.companyId, workDate),
    listAttendanceRecords(session.companyId, workDate)
  ]);
  const manualDevices = devices.filter((d) => d.adapterType === 'MANUAL');

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>PDKS (Personel Devam Kontrol Sistemi)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Cihaz Adapter → Raw Punch (silinmez) → Yoklama İşleme akışı — bu faz cihaz entegrasyonu içermiyor, yalnızca Manuel adaptör ile test/backfill (İK Mimarisi raporu §06, Faz 2).</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Vardiyalar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Saatler</th><th style={{ padding: '6px 8px' }}>Mola</th><th style={{ padding: '6px 8px' }}>Tolerans</th>
          </tr>
        </thead>
        <tbody>
          {shiftList.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.code}</td>
              <td style={{ padding: '6px 8px' }}>{s.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.startTime}–{s.endTime}{s.crossesMidnight ? ' (gece)' : ''}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.breakMinutes} dk</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.graceMinutes} dk</td>
            </tr>
          ))}
          {shiftList.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz vardiya yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create ? <div style={{ marginBottom: 24 }}><ShiftForm departmentId={departmentId} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Çalışan Vardiya Ataması</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Mevcut Vardiya</th></tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{e.firstName} {e.lastName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{e.shiftName ?? '—'}</td>
            </tr>
          ))}
          {employees.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz çalışan yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? (
        <div style={{ marginBottom: 24 }}>
          <AssignShiftForm departmentId={departmentId} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} shiftOptions={shiftList.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>PDKS Cihazları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Adaptör</th></tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{d.code}</td>
              <td style={{ padding: '6px 8px' }}>{d.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{ADAPTER_LABELS[d.adapterType] ?? d.adapterType}</td>
            </tr>
          ))}
          {devices.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz cihaz yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create ? <div style={{ marginBottom: 24 }}><DeviceForm departmentId={departmentId} /></div> : null}

      <form method="get" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--dim-on-surface-variant)', marginRight: 8 }}>Tarih:</label>
        <input type="date" name="date" defaultValue={workDate} style={{ padding: 6 }} />
        <button type="submit" style={{ padding: '6px 12px', marginLeft: 8, cursor: 'pointer' }}>Göster</button>
      </form>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ham Giriş/Çıkış Kayıtları — {workDate}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Saat</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Cihaz</th><th style={{ padding: '6px 8px' }}>Yön</th><th style={{ padding: '6px 8px' }}>İşlendi</th></tr>
        </thead>
        <tbody>
          {rawPunches.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{formatTime(p.punchAt)}</td>
              <td style={{ padding: '6px 8px' }}>{p.employeeFirstName ? `${p.employeeFirstName} ${p.employeeLastName}` : '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.deviceName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{DIRECTION_LABELS[p.direction] ?? p.direction}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.processed ? 'Evet' : 'Hayır'}</td>
            </tr>
          ))}
          {rawPunches.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bu tarihte kayıt yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create && manualDevices.length > 0 ? <div style={{ marginBottom: 24 }}><ManualPunchForm departmentId={departmentId} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} manualDevices={manualDevices.map((d) => ({ id: d.id, name: d.name }))} /></div> : null}
      {access.permissions.create && manualDevices.length === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13, marginBottom: 24 }}>Manuel giriş için önce yukarıdan "Manuel" adaptörlü bir cihaz ekleyin.</p> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Yoklama Kayıtları — {workDate}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Giriş</th><th style={{ padding: '6px 8px' }}>Çıkış</th><th style={{ padding: '6px 8px' }}>Çalışılan</th><th style={{ padding: '6px 8px' }}>Geç</th><th style={{ padding: '6px 8px' }}>Erken Çıkış</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {attendanceRecords.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{a.employeeFirstName} {a.employeeLastName}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{formatTime(a.checkInAt)}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{formatTime(a.checkOutAt)}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{a.workedMinutes !== null ? `${a.workedMinutes} dk` : '—'}</td>
              <td style={{ padding: '6px 8px', color: a.lateMinutes > 0 ? '#a3572a' : '#666' }}>{a.lateMinutes} dk</td>
              <td style={{ padding: '6px 8px', color: a.earlyLeaveMinutes > 0 ? '#a3572a' : '#666' }}>{a.earlyLeaveMinutes} dk</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[a.status] ?? a.status}</td>
            </tr>
          ))}
          {attendanceRecords.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bu tarih için henüz işlenmiş yoklama kaydı yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <ProcessAttendanceForm departmentId={departmentId} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} defaultDate={workDate} /> : null}
    </div>
  );
}
