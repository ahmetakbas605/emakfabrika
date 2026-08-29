import { requireSession } from '@/lib/dal';
import { getAward } from '@/lib/procurement/award';
import { SubmitAwardButton, CancelAwardButton } from '@/components/procurement/award-form';

const AWARD_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };
const APPROVAL_STEP_STATUS_LABEL: Record<string, string> = { PENDING: 'Sırada', IN_PROGRESS: 'Aktif', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };

function fmt(d: string | Date) {
  return new Date(d).toLocaleString('tr-TR');
}

export default async function AwardDetailPage({ params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  const session = await requireSession();
  const { award, lines, total, approval } = await getAward(session.companyId, awardId);

  const canSubmit = (award.status === 'DRAFT' || award.status === 'REVISION_REQUIRED') && award.createdByUserId === session.id;
  const canCancel = (award.status === 'DRAFT' || award.status === 'REVISION_REQUIRED') && award.createdByUserId === session.id;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{award.awardNo}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{AWARD_STATUS_LABEL[award.status] ?? award.status} · Toplam: {Number(total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {canSubmit ? <SubmitAwardButton awardId={awardId} /> : null}
        {canCancel ? <CancelAwardButton awardId={awardId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ödül Satırları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kalem</th>
            <th style={{ padding: '6px 8px' }}>Tedarikçi</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birim Fiyat</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px' }}>{l.supplierName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.awardedQty).toLocaleString('tr-TR')} {l.unitCode}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.awardedUnitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(l.awardedTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {approval ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Onay Süreci</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approval.steps.map((step) => (
              <div key={step.id} style={{ borderLeft: '2px solid #ddd', paddingLeft: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{step.stepOrder + 1}. adım — {APPROVAL_STEP_STATUS_LABEL[step.status] ?? step.status}</span>
                <span style={{ color: '#666' }}> ({step.approvers.map((a) => a.userName).join(', ')})</span>
                {step.actions.map((a, i) => (
                  <p key={i} style={{ margin: '4px 0 0', color: '#666' }}>{a.actedByName}: {a.decision}{a.comment ? ` — ${a.comment}` : ''} ({fmt(a.createdAt)})</p>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
