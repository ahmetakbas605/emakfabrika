import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listJournals } from '@/lib/accounting';

export default async function JournalsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const journals = await listJournals(session.companyId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>Muhasebe Fişleri</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>{journals.length} fiş</p>
        </div>
        {access.permissions.post ? (
          <Link href={`/dashboard/departments/${departmentId}/journals/new`} style={{ padding: '8px 14px', border: '1px solid #333', textDecoration: 'none', color: '#111', borderRadius: 4 }}>
            + Yeni Fiş
          </Link>
        ) : null}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Fiş No</th>
            <th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Açıklama</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {journals.map((j) => (
            <tr key={j.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{j.journalNo}</td>
              <td style={{ padding: '6px 8px' }}>{j.journalDate}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{j.documentType}</td>
              <td style={{ padding: '6px 8px' }}>{j.description}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: j.status === 'REVERSED' ? '#b00' : '#080' }}>{j.status === 'REVERSED' ? 'Ters Kayıt Alındı' : 'Muhasebeleşti'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
