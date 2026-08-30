import { requireSession } from '@/lib/dal';
import { listOvertimeRequests } from '@/lib/hr/overtime';
import { CreateOvertimeForm, SubmitOvertimeButton, CancelOvertimeButton } from '@/components/hr/overtime-forms';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

export default async function OvertimePage() {
  const session = await requireSession();

  if (!session.employeeId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Fazla Mesai Taleplerim</h1>
        <p style={{ color: '#666' }}>ERP hesabınız bir özlük kaydına bağlı değil — talep oluşturabilmek için İK ile iletişime geçin.</p>
      </div>
    );
  }

  const requests = await listOvertimeRequests(session.companyId, session.employeeId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Fazla Mesai Taleplerim</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Onay motoru genel — bkz. Onay Kutusu.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Saat</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.overtimeNo}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{r.workDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.hours}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {r.status === 'DRAFT' || r.status === 'REVISION_REQUIRED' ? (
                  <>
                    <SubmitOvertimeButton overtimeRequestId={r.id} />
                    <CancelOvertimeButton overtimeRequestId={r.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {requests.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz fazla mesai talebiniz yok.</td></tr> : null}
        </tbody>
      </table>

      <CreateOvertimeForm />
    </div>
  );
}
