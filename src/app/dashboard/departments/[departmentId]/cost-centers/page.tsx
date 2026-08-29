import { requireDepartmentAccess } from '@/lib/dal';
import { listCostCenters, getCostCenterReport } from '@/lib/cost-centers';
import { CostCenterForm } from '@/components/cost-center-form';

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export default async function CostCentersPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [costCenters, report] = await Promise.all([listCostCenters(session.companyId), getCostCenterReport(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Masraf Merkezi</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Muhasebe fişi satırlarına atanmış masraf merkezlerine göre gelir/gider analizi (PDF madde 34).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Borç</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Alacak</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {report.map((r) => (
            <tr key={r.costCenterId} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.costCenterCode}</td>
              <td style={{ padding: '6px 8px' }}>{r.costCenterName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(r.totalDebit)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(r.totalCredit)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{money(r.net)}</td>
            </tr>
          ))}
          {costCenters.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz masraf merkezi yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <CostCenterForm departmentId={departmentId} /> : null}
    </div>
  );
}
