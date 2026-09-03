import { requireDepartmentAccess } from '@/lib/dal';
import { getFinancialStatements, type TrialBalanceRow } from '@/lib/accounting';

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function Section({ title, rows }: { title: string; rows: TrialBalanceRow[] }) {
  const total = rows.reduce((s, r) => s + Number(r.balance), 0);
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 6 }}>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountCode} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '5px 8px', fontFamily: 'monospace', width: 60 }}>{r.accountCode}</td>
              <td style={{ padding: '5px 8px' }}>{r.accountName}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(r.balance)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--dim-border)', fontWeight: 700 }}>
            <td colSpan={2} style={{ padding: '5px 8px' }}>Toplam</td>
            <td style={{ padding: '5px 8px', textAlign: 'right' }}>{money(total.toFixed(2))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function BalanceSheetPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId, 'view');
  const fs = await getFinancialStatements(session.companyId);
  const balanced = Math.abs(Number(fs.totalAssets) - Number(fs.totalLiabilitiesAndEquity)) < 0.005;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Bilanço</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Mizandan türetilir — sıfır bakiyeli hesaplar gösterilmez.</p>

      <Section title="Varlıklar (Aktif)" rows={fs.assets} />
      <Section title="Borçlar (Pasif)" rows={fs.liabilities} />
      <Section title="Özkaynaklar" rows={fs.equity} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid var(--dim-border)', paddingTop: 10 }}>
        <span>Toplam Aktif: {money(fs.totalAssets)}</span>
        <span>Toplam Pasif + Özkaynak (Dönem Net Kârı Dahil): {money(fs.totalLiabilitiesAndEquity)}</span>
      </div>
      <p style={{ marginTop: 8, fontSize: 13, color: balanced ? '#080' : 'var(--dim-danger)', fontWeight: 600 }}>{balanced ? 'Bilanço denk.' : 'BİLANÇO DENGESİZ — bir hata var.'}</p>
    </div>
  );
}
