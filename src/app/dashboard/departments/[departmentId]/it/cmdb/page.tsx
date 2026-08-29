import { requireDepartmentAccess } from '@/lib/dal';
import { listAssets } from '@/lib/it/assets';
import { listConfigurationItems, listRelationships } from '@/lib/it/cmdb';
import { PromoteToCIForm } from '@/components/it/promote-to-ci-form';
import { RelationshipForm } from '@/components/it/relationship-form';

export default async function CmdbPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [cis, assets, relationships] = await Promise.all([listConfigurationItems(session.companyId), listAssets(session.companyId), listRelationships(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>CMDB</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Yalnızca bağımlılık/etki analizi gereken varlıklar CI'ya yükseltilir — her varlık otomatik CI olmaz (CMDB.md).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>CI Key</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {cis.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.ciKey}</td>
              <td style={{ padding: '6px 8px' }}>{c.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.ciType}{c.assetTypeName ? ` (${c.assetTypeName})` : ''}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.status}</td>
            </tr>
          ))}
          {cis.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz CI yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.configure ? (
        <div style={{ marginBottom: 20 }}>
          <PromoteToCIForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>İlişkiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kaynak</th>
            <th style={{ padding: '6px 8px' }}>İlişki</th>
            <th style={{ padding: '6px 8px' }}>Hedef</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{r.sourceCiKey} — {r.sourceCiName}</td>
              <td style={{ padding: '6px 8px', color: '#666', fontFamily: 'monospace' }}>{r.relationshipType}</td>
              <td style={{ padding: '6px 8px' }}>{r.targetCiKey} — {r.targetCiName}</td>
            </tr>
          ))}
          {relationships.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: '#999' }}>Henüz ilişki yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.configure && cis.length > 0 ? <RelationshipForm departmentId={departmentId} cis={cis.map((c) => ({ id: c.id, ciKey: c.ciKey, name: c.name }))} /> : null}
    </div>
  );
}
