import { requireSession } from '@/lib/dal';
import { getNcr } from '@/lib/quality/ncr';
import { StartNcrInvestigationButton, RecordNcrRootCauseForm, RecordNcrActionsForm, CloseNcrButton, RejectNcrButton } from '@/components/quality/quality-forms';

const NCR_STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', INVESTIGATING: 'Soruşturuluyor', CORRECTIVE_ACTION: 'Düzeltici Faaliyet', VERIFICATION: 'Doğrulama', CLOSED: 'Kapalı', REJECTED: 'Reddedildi' };
const SEVERITY_LABELS: Record<string, string> = { MINOR: 'Düşük', MAJOR: 'Orta', CRITICAL: 'Kritik' };

export default async function NcrDetailPage({ params }: { params: Promise<{ ncrId: string }> }) {
  const { ncrId } = await params;
  const session = await requireSession();
  const ncr = await getNcr(session.companyId, ncrId);

  const isTerminal = ncr.status === 'CLOSED' || ncr.status === 'REJECTED';

  return (
    <div style={{ padding: '2rem', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{ncr.ncrNo} — {ncr.title}</h1>
        <span style={{ fontWeight: 600 }}>{NCR_STATUS_LABELS[ncr.status]}</span>
      </div>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Önem: {SEVERITY_LABELS[ncr.severity]} · Oluşturulma: {new Date(ncr.createdAt).toLocaleString('tr-TR')}{ncr.closedAt ? ` · Kapanış: ${new Date(ncr.closedAt).toLocaleString('tr-TR')}` : ''}</p>

      <p style={{ marginBottom: 20, fontSize: 14 }}>{ncr.description}</p>

      {ncr.status === 'OPEN' ? (
        <div style={{ marginBottom: 20 }}><StartNcrInvestigationButton ncrId={ncr.id} /><RejectNcrButton ncrId={ncr.id} /></div>
      ) : null}

      {ncr.status === 'INVESTIGATING' ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kök Neden</h2>
          <RecordNcrRootCauseForm ncrId={ncr.id} />
          <RejectNcrButton ncrId={ncr.id} />
        </div>
      ) : null}

      {ncr.rootCause ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kök Neden</h2>
          <p style={{ fontSize: 13, color: '#666' }}>{ncr.rootCause}</p>
        </div>
      ) : null}

      {ncr.status === 'CORRECTIVE_ACTION' ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Düzeltici / Önleyici Faaliyet</h2>
          <RecordNcrActionsForm ncrId={ncr.id} />
          <RejectNcrButton ncrId={ncr.id} />
        </div>
      ) : null}

      {ncr.correctiveAction ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Düzeltici Faaliyet</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{ncr.correctiveAction}</p>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Önleyici Faaliyet</h2>
          <p style={{ fontSize: 13, color: '#666' }}>{ncr.preventiveAction}</p>
        </div>
      ) : null}

      {ncr.status === 'VERIFICATION' ? (
        <div style={{ marginBottom: 20 }}>
          <CloseNcrButton ncrId={ncr.id} />
          <RejectNcrButton ncrId={ncr.id} />
        </div>
      ) : null}

      {isTerminal ? <p style={{ fontSize: 13, color: ncr.status === 'CLOSED' ? '#080' : '#b00' }}>Bu NCR sonuçlanmıştır, yeni bir işlem yapılamaz.</p> : null}
    </div>
  );
}
