import { requireSession } from '@/lib/dal';
import { listLeaveRequests, listLeaveBalancesForEmployee } from '@/lib/hr/leave';
import { CreateLeaveForm, SubmitLeaveButton, CancelLeaveButton, LEAVE_TYPE_LABELS } from '@/components/hr/leave-forms';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

export default async function LeavePage() {
  const session = await requireSession();

  if (!session.employeeId) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>İzin Taleplerim</h1>
        <p style={{ color: '#666' }}>ERP hesabınız bir özlük kaydına bağlı değil — izin talebi oluşturabilmek için İK ile iletişime geçin.</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const [requests, balances] = await Promise.all([
    listLeaveRequests(session.companyId, session.employeeId),
    listLeaveBalancesForEmployee(session.companyId, session.employeeId, currentYear)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İzin Taleplerim</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Onay motoru genel — bkz. Onay Kutusu. İzin türü "Devamsızlık" plansız/mazeretsiz gaybubeti sonradan bildirmek için kullanılır.</p>

      {balances.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>{currentYear} Bakiyem</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Hak Ediş</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Kullanılan</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Kalan</th></tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.leaveType} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{LEAVE_TYPE_LABELS[b.leaveType] ?? b.leaveType}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{b.entitlementDays}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{b.usedDays}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{b.remainingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Taleplerim</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Tarih Aralığı</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Gün</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.leaveNo}</td>
              <td style={{ padding: '6px 8px' }}>{LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{r.startDate} – {r.endDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.dayCount}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {r.status === 'DRAFT' || r.status === 'REVISION_REQUIRED' ? (
                  <>
                    <SubmitLeaveButton leaveRequestId={r.id} />
                    <CancelLeaveButton leaveRequestId={r.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {requests.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz izin talebiniz yok.</td></tr> : null}
        </tbody>
      </table>

      <CreateLeaveForm />
    </div>
  );
}
