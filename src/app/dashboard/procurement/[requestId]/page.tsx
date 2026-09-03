import { requireSession } from '@/lib/dal';
import { getProcRequest } from '@/lib/procurement/requisition';
import { SubmitRequestButton, CancelRequestButton, LineStockStatusForm, LineAttachmentForm } from '@/components/procurement/proc-request-actions';

const REQUEST_TYPE_LABEL: Record<string, string> = {
  NORMAL: 'Normal', URGENT: 'Acil', EMERGENCY: 'Çok Acil', PROJECT: 'Proje', PRODUCTION: 'Üretim', MAINTENANCE: 'Bakım',
  IT: 'BT', OFFICE: 'Ofis', RAW_MATERIAL: 'Hammadde', SERVICE: 'Hizmet', CAPEX: 'CAPEX', OPEX: 'OPEX', STOCK_REPLENISHMENT: 'Stok Tamamlama'
};
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };
const STOCK_STATUS_LABEL: Record<string, string> = { PENDING: 'Bekliyor', STOCK_AVAILABLE: 'Stokta Var', STOCK_PARTIAL: 'Kısmen Var', STOCK_UNAVAILABLE: 'Stokta Yok', NEW_PURCHASE_REQUIRED: 'Satınalma Gerekli' };
const APPROVAL_STEP_STATUS_LABEL: Record<string, string> = { PENDING: 'Sırada', IN_PROGRESS: 'Aktif', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };

function fmt(d: string | Date) {
  return new Date(d).toLocaleString('tr-TR');
}

export default async function ProcRequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await requireSession();
  const { request, lines, approval } = await getProcRequest(session.companyId, requestId);

  const canSubmit = (request.status === 'DRAFT' || request.status === 'REVISION_REQUIRED') && request.requestedByUserId === session.id;
  const canCancel = request.status === 'DRAFT' && request.requestedByUserId === session.id;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{request.requestNo}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        {REQUEST_TYPE_LABEL[request.requestType] ?? request.requestType} · {request.priority} · {STATUS_LABEL[request.status] ?? request.status}
        {request.estimatedTotal ? ` · Tahmini: ${Number(request.estimatedTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${request.currencyCode ?? ''}` : ''}
      </p>
      {request.justification ? <p style={{ marginBottom: 20, fontSize: 13, whiteSpace: 'pre-wrap' }}>{request.justification}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {canSubmit ? <SubmitRequestButton requestId={requestId} /> : null}
        {canCancel ? <CancelRequestButton requestId={requestId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kalemler</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {lines.map((line) => (
          <div key={line.id} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 4, padding: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <b>{line.description}</b>
                <span style={{ color: 'var(--dim-on-surface-variant)' }}> — {Number(line.quantity).toLocaleString('tr-TR')} adet{line.preferredBrand ? ` · ${line.preferredBrand}` : ''}</span>
              </div>
              <span>{STOCK_STATUS_LABEL[line.stockStatus] ?? line.stockStatus}</span>
            </div>
            {line.technicalSpec && typeof line.technicalSpec === 'object' && 'description' in line.technicalSpec ? (
              <p style={{ color: 'var(--dim-on-surface-variant)', margin: '6px 0 0' }}>{String((line.technicalSpec as { description: unknown }).description)}</p>
            ) : null}
            {line.reservedQty && Number(line.reservedQty) > 0 ? <p style={{ color: 'var(--dim-success)', margin: '6px 0 0', fontSize: 12 }}>Rezerve edilen: {Number(line.reservedQty).toLocaleString('tr-TR')}</p> : null}
            {line.purchaseQty && Number(line.purchaseQty) > 0 ? <p style={{ color: 'var(--dim-warning)', margin: '4px 0 0', fontSize: 12 }}>Satın alınacak: {Number(line.purchaseQty).toLocaleString('tr-TR')}</p> : null}

            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--dim-slate)' }}>Ek Dosyalar: </span>
              {line.attachments.map((a) => <span key={a.id} style={{ fontSize: 11, marginRight: 8 }}>{a.fileName}</span>)}
              {line.attachments.length === 0 ? <span style={{ fontSize: 11, color: 'var(--dim-slate)' }}>yok</span> : null}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <LineAttachmentForm requestId={requestId} lineId={line.id} />
              {request.status === 'SUBMITTED' ? <LineStockStatusForm requestId={requestId} lineId={line.id} currentStatus={line.stockStatus} /> : null}
            </div>
          </div>
        ))}
      </div>

      {approval ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Onay Süreci</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approval.steps.map((step) => (
              <div key={step.id} style={{ borderLeft: '2px solid var(--dim-border)', paddingLeft: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{step.stepOrder + 1}. adım — {APPROVAL_STEP_STATUS_LABEL[step.status] ?? step.status}</span>
                <span style={{ color: 'var(--dim-on-surface-variant)' }}> ({step.approvers.map((a) => a.userName).join(', ')})</span>
                {step.actions.map((a, i) => (
                  <p key={i} style={{ margin: '4px 0 0', color: 'var(--dim-on-surface-variant)' }}>{a.actedByName}: {a.decision}{a.comment ? ` — ${a.comment}` : ''} ({fmt(a.createdAt)})</p>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
