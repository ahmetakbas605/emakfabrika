import { requireDepartmentAccess } from '@/lib/dal';
import { listPeriods } from '@/lib/accounting';
import { PeriodForm } from '@/components/period-form';
import { PeriodStatusButton } from '@/components/period-status-button';

export default async function PeriodsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const periods = await listPeriods(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Muhasebe Dönemleri</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Kapalı bir döneme yeni fiş işlenemez — yalnızca ters kayıt/düzeltme fişi (PDF madde 17, 77).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Başlangıç</th>
            <th style={{ padding: '6px 8px' }}>Bitiş</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{p.periodStart}</td>
              <td style={{ padding: '6px 8px' }}>{p.periodEnd}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: p.status === 'OPEN' ? '#080' : '#b00' }}>{p.status === 'OPEN' ? 'Açık' : 'Kapalı'}</td>
              <td style={{ padding: '6px 8px' }}>
                {(p.status === 'OPEN' && access.permissions.close_period) || (p.status === 'CLOSED' && access.permissions.reopen_period) ? (
                  <PeriodStatusButton departmentId={departmentId} periodId={p.id} status={p.status} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {access.permissions.create ? <PeriodForm departmentId={departmentId} /> : null}
    </div>
  );
}
