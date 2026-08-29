import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listDiagrams } from '@/lib/it/network-diagram';
import { DiagramForm } from '@/components/it/diagram-form';

export default async function NetworkDiagramListPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const diagrams = await listDiagrams(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ağ Diyagramları</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Her kaydetme yeni bir versiyon açar — eski versiyon silinmez (NETWORK.md §3).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Durum</th></tr></thead>
        <tbody>
          {diagrams.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/departments/${departmentId}/it/network-diagram/${d.id}`}>{d.name}</Link></td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{d.currentVersionId ? 'Kayıtlı versiyon var' : 'Henüz boş'}</td>
            </tr>
          ))}
          {diagrams.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Henüz diyagram yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.configure ? <DiagramForm departmentId={departmentId} /> : null}
    </div>
  );
}
