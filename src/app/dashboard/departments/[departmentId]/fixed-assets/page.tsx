import { requireDepartmentAccess } from '@/lib/dal';
import { listFixedAssets, getAccumulatedDepreciation } from '@/lib/fixed-assets';
import { listAccounts } from '@/lib/accounting';
import { money as toMoney } from '@/lib/money';
import { FixedAssetForm } from '@/components/fixed-asset-form';
import { RunDepreciationButton } from '@/components/run-depreciation-button';

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export default async function FixedAssetsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [assets, accounts] = await Promise.all([listFixedAssets(session.companyId), listAccounts(session.companyId)]);
  const accumulated = await Promise.all(assets.map((a) => getAccumulatedDepreciation(a.id)));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Demirbaş</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Doğrusal amortisman — her ay için bir kez işlenebilir (PDF madde 32).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Maliyet</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birikmiş Amortisman</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net Defter Değeri</th>
            <th style={{ padding: '6px 8px' }}>Faydalı Ömür</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => {
            const cost = toMoney(a.purchaseCost);
            const accum = accumulated[i];
            const net = cost.minus(accum);
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{a.name}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(cost.toFixed(2))}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(accum.toFixed(2))}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{money(net.toFixed(2))}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{a.usefulLifeYears} yıl</td>
                <td style={{ padding: '6px 8px' }}>{access.permissions.post ? <RunDepreciationButton departmentId={departmentId} fixedAssetId={a.id} /> : null}</td>
              </tr>
            );
          })}
          {assets.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz demirbaş yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <FixedAssetForm departmentId={departmentId} accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} /> : null}
    </div>
  );
}
