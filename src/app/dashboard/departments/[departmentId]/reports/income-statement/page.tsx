import { requireDepartmentAccess } from '@/lib/dal';
import { getFinancialStatements } from '@/lib/accounting';

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export default async function IncomeStatementPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId, 'view');
  const fs = await getFinancialStatements(session.companyId);
  const positive = Number(fs.netIncome) >= 0;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Gelir Tablosu</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Vergi karşılığı hesaplanmamıştır — dönem net kârı/zararı vergi öncesidir (bkz. MEVZUAT-MAP.md).</p>

      <h2 style={{ fontSize: 15, marginBottom: 6 }}>Gelirler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <tbody>
          {fs.revenue.map((r) => (
            <tr key={r.accountCode} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '5px 8px', fontFamily: 'monospace', width: 60 }}>{r.accountCode}</td>
              <td style={{ padding: '5px 8px' }}>{r.accountName}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(r.balance)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid #333', fontWeight: 700 }}>
            <td colSpan={2} style={{ padding: '5px 8px' }}>Toplam Gelir</td>
            <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(fs.totalRevenue)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 6 }}>Giderler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <tbody>
          {fs.expense.map((r) => (
            <tr key={r.accountCode} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '5px 8px', fontFamily: 'monospace', width: 60 }}>{r.accountCode}</td>
              <td style={{ padding: '5px 8px' }}>{r.accountName}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(r.balance)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid #333', fontWeight: 700 }}>
            <td colSpan={2} style={{ padding: '5px 8px' }}>Toplam Gider</td>
            <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(fs.totalExpense)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: '2px solid #333', paddingTop: 10, fontSize: 16, fontWeight: 700, color: positive ? '#080' : '#b00' }}>
        Dönem Net {positive ? 'Kârı' : 'Zararı'}: {money(fs.netIncome)}
      </div>
    </div>
  );
}
