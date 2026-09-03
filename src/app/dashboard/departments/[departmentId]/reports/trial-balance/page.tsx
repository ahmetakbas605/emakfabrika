import { requireDepartmentAccess } from '@/lib/dal';
import { getTrialBalance } from '@/lib/accounting';

export default async function TrialBalancePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId, 'view');
  const rows = await getTrialBalance(session.companyId);

  const totalDebit = rows.reduce((s, r) => s + Number(r.totalDebit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.totalCredit), 0);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Mizan</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Yalnızca muhasebeleşmiş (POSTED) fişler dahildir — ters kaydı alınmış fişler hariç.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Hesap</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Borç</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Alacak</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Bakiye</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountCode} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.accountCode}</td>
              <td style={{ padding: '6px 8px' }}>{r.accountName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(r.totalDebit).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(r.totalCredit).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(r.balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--dim-border)', fontWeight: 700 }}>
            <td colSpan={2} style={{ padding: '6px 8px' }}>TOPLAM</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: Math.abs(totalDebit - totalCredit) < 0.005 ? '#080' : 'var(--dim-danger)' }}>
              {Math.abs(totalDebit - totalCredit) < 0.005 ? 'Denk' : 'DENGESİZ'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
