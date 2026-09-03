import { requireSession } from '@/lib/dal';
import { listWorkCenters } from '@/lib/production/workcenters';
import { CreateWorkCenterForm } from '@/components/production/workcenter-forms';

export default async function WorkCentersPage() {
  const session = await requireSession();
  const workCenters = await listWorkCenters(session.companyId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İş Merkezleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Routing operasyonlarının atandığı makine/hat/grup tanımları.</p>

      <div style={{ marginBottom: 20 }}><CreateWorkCenterForm /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Kapasite/Saat</th>
          </tr>
        </thead>
        <tbody>
          {workCenters.map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{w.code}</td>
              <td style={{ padding: '6px 8px' }}>{w.name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{w.capacityPerHour ?? '—'}</td>
            </tr>
          ))}
          {workCenters.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz iş merkezi yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
