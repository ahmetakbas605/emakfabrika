import { requireDepartmentAccess } from '@/lib/dal';
import { getSubnet, listSubnetIps, listIpAssignments } from '@/lib/it/ipam';
import { listAssets } from '@/lib/it/assets';
import { AssignIpForm } from '@/components/it/assign-ip-form';
import { ReleaseIpForm } from '@/components/it/release-ip-form';

const STATUS_LABELS: Record<string, string> = { AVAILABLE: 'Boş', ASSIGNED: 'Atanmış', RESERVED: 'Rezerve', CONFLICT: 'Çakışma', BLOCKED: 'Bloke', UNKNOWN: 'Bilinmiyor' };
const STATUS_COLORS: Record<string, string> = { AVAILABLE: 'var(--dim-slate)', ASSIGNED: 'var(--dim-success)', RESERVED: 'var(--dim-warning)', CONFLICT: 'var(--dim-danger)', BLOCKED: 'var(--dim-danger)', UNKNOWN: 'var(--dim-slate)' };

export default async function SubnetDetailPage({ params }: { params: Promise<{ departmentId: string; subnetId: string }> }) {
  const { departmentId, subnetId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [subnet, { ips, truncated }, assignments, assets] = await Promise.all([
    getSubnet(session.companyId, subnetId), listSubnetIps(session.companyId, subnetId), listIpAssignments(session.companyId, subnetId), listAssets(session.companyId)
  ]);

  const assignmentByIp = new Map(assignments.map((a) => [a.ipAddress, a]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{subnet.cidr}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Gateway: {subnet.gateway || '—'} · {subnet.description || 'Açıklama yok'}</p>
      {truncated ? <p style={{ color: 'var(--dim-warning)', fontSize: 12, marginBottom: 12 }}>Bu subnet çok büyük — yalnızca ilk 4096 host adresi listeleniyor (TODO: IP_RANGE_PAGINATION).</p> : null}

      {access.permissions.assign ? <div style={{ marginBottom: 20 }}><AssignIpForm departmentId={departmentId} subnetId={subnetId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /></div> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>IP</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Varlık</th>
            <th style={{ padding: '6px 8px' }}>Arayüz</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {ips.map((ip) => {
            const assignment = assignmentByIp.get(ip.ipAddress);
            return (
              <tr key={ip.ipAddress} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{ip.ipAddress}</td>
                <td style={{ padding: '4px 8px', color: STATUS_COLORS[ip.status], fontWeight: 600 }}>{STATUS_LABELS[ip.status] ?? ip.status}</td>
                <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{assignment?.assetTag || '—'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--dim-on-surface-variant)' }}>{assignment?.interfaceName || '—'}</td>
                <td style={{ padding: '4px 8px' }}>{access.permissions.assign && assignment ? <ReleaseIpForm departmentId={departmentId} subnetId={subnetId} assignmentId={assignment.id} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
