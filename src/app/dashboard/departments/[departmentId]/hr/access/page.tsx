import { requireDepartmentAccess } from '@/lib/dal';
import { listEmployees } from '@/lib/hr/employees';
import { listDevices } from '@/lib/hr/pdks';
import { listAccessZones, listAccessGroups, listGroupMembers, listCards, listAccessLogsForDate } from '@/lib/hr/access';
import { ZoneForm, GroupForm, AddZoneToGroupForm, AddGroupMemberForm, IssueCardForm, CardStatusButtons, RecordAccessAttemptForm } from '@/components/hr/access-forms';

const RESULT_LABELS: Record<string, string> = { GRANTED: 'İzin Verildi', DENIED: 'Reddedildi' };

function formatTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default async function AccessControlPage({ params, searchParams }: { params: Promise<{ departmentId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const { date } = await searchParams;
  const workDate = date || new Date().toISOString().slice(0, 10);

  const [employees, zones, groups, devices, cards, accessLogs] = await Promise.all([
    listEmployees(session.companyId),
    listAccessZones(session.companyId),
    listAccessGroups(session.companyId),
    listDevices(session.companyId),
    listCards(session.companyId),
    listAccessLogsForDate(session.companyId, workDate)
  ]);
  const manualDevices = devices.filter((d) => d.adapterType === 'MANUAL');
  const groupMembersByGroup = await Promise.all(groups.map((g) => listGroupMembers(session.companyId, g.id)));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Erişim Kontrolü</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>PDKS'in AYNI cihaz-adapter altyapısını paylaşır — bu faz cihaz entegrasyonu içermiyor, yalnızca Manuel adaptör ile test (İK Mimarisi raporu §06, Faz 4).</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bölgeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Açıklama</th></tr></thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}><td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{z.code}</td><td style={{ padding: '6px 8px' }}>{z.name}</td><td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{z.description || '—'}</td></tr>
          ))}
          {zones.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz bölge yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create ? <div style={{ marginBottom: 24 }}><ZoneForm departmentId={departmentId} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Erişim Grupları</h2>
      {groups.map((g, i) => (
        <div key={g.id} style={{ marginBottom: 8, fontSize: 13 }}>
          <strong>{g.name}</strong> ({g.code}) — Üyeler: {groupMembersByGroup[i].length === 0 ? '—' : groupMembersByGroup[i].map((m) => `${m.firstName} ${m.lastName}${m.validUntil ? ` (${m.validUntil}'e kadar)` : ''}`).join(', ')}
        </div>
      ))}
      {groups.length === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Henüz grup yok.</p> : null}
      {access.permissions.create ? <div style={{ marginBottom: 12, marginTop: 8 }}><GroupForm departmentId={departmentId} /></div> : null}
      {access.permissions.update ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <AddZoneToGroupForm departmentId={departmentId} groups={groups.map((g) => ({ id: g.id, name: g.name }))} zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
          <AddGroupMemberForm departmentId={departmentId} groups={groups.map((g) => ({ id: g.id, name: g.name }))} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kartlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Kart No</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th></tr></thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.cardNumber}</td>
              <td style={{ padding: '6px 8px' }}>{c.firstName} {c.lastName}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.status}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.update ? <CardStatusButtons departmentId={departmentId} cardId={c.id} currentStatus={c.status} /> : null}</td>
            </tr>
          ))}
          {cards.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz kart tanımlı değil.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create ? <div style={{ marginBottom: 24 }}><IssueCardForm departmentId={departmentId} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} /></div> : null}

      <form method="get" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--dim-on-surface-variant)', marginRight: 8 }}>Tarih:</label>
        <input type="date" name="date" defaultValue={workDate} style={{ padding: 6 }} />
        <button type="submit" style={{ padding: '6px 12px', marginLeft: 8, cursor: 'pointer' }}>Göster</button>
      </form>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Erişim Kayıtları — {workDate}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Saat</th><th style={{ padding: '6px 8px' }}>Bölge</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Sonuç</th><th style={{ padding: '6px 8px' }}>Neden</th></tr></thead>
        <tbody>
          {accessLogs.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{formatTime(l.accessAt)}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.zoneName}</td>
              <td style={{ padding: '6px 8px' }}>{l.firstName ? `${l.firstName} ${l.lastName}` : '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: l.result === 'GRANTED' ? '#3f6b4a' : '#a33636' }}>{RESULT_LABELS[l.result] ?? l.result}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.reason || '—'}</td>
            </tr>
          ))}
          {accessLogs.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Bu tarihte kayıt yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.create && manualDevices.length > 0 ? <RecordAccessAttemptForm departmentId={departmentId} manualDevices={manualDevices.map((d) => ({ id: d.id, name: d.name }))} zones={zones.map((z) => ({ id: z.id, name: z.name }))} /> : null}
      {access.permissions.create && manualDevices.length === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Manuel test için önce PDKS sayfasından "Manuel" adaptörlü bir cihaz ekleyin (cihaz altyapısı PDKS ile ortak).</p> : null}
    </div>
  );
}
