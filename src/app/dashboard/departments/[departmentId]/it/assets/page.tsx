import { requireDepartmentAccess } from '@/lib/dal';
import { listCompanyUsers } from '@/lib/dal';
import { listAssets, listAssetTypes } from '@/lib/it/assets';
import { AssetForm } from '@/components/it/asset-form';
import { AssignAssetForm } from '@/components/it/assign-asset-form';

const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'Stokta', ASSIGNED: 'Atanmış', INSTALLED: 'Kurulu', IN_SERVICE: 'Hizmette',
  UNDER_MAINTENANCE: 'Bakımda', REPAIR: 'Onarımda', LOST: 'Kayıp', STOLEN: 'Çalıntı',
  RETIRED: 'Emekli', DISPOSED: 'İmha Edildi', UNKNOWN: 'Bilinmiyor'
};

export default async function ItAssetsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [assets, assetTypes, companyUsers] = await Promise.all([listAssets(session.companyId), listAssetTypes(), listCompanyUsers(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>IT Varlıkları</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Her varlığın kendi durum geçmişi ve kullanıcı atama geçmişi tutulur (PDF madde 6, 8).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Etiket</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Üretici/Model</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.assetTag}</td>
              <td style={{ padding: '6px 8px' }}>{a.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.assetTypeName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.manufacturer} {a.model}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[a.status] ?? a.status}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.assign ? <AssignAssetForm departmentId={departmentId} assetId={a.id} users={companyUsers} /> : null}</td>
            </tr>
          ))}
          {assets.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz varlık yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.manage_assets ? <AssetForm departmentId={departmentId} assetTypes={assetTypes} /> : null}
    </div>
  );
}
