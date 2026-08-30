import { requireSession } from '@/lib/dal';
import { getPurchaseOrder } from '@/lib/procurement/purchaseOrder';
import { IssuePoButton, AcknowledgePoButton, CancelPoButton, PoAttachmentForm } from '@/components/procurement/po-actions';

const PO_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', ISSUED: 'Gönderildi', ACKNOWLEDGED: 'Tedarikçi Onayladı', CANCELLED: 'İptal' };

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ poId: string }> }) {
  const { poId } = await params;
  const session = await requireSession();
  const { po, supplierName, lines, total, attachments } = await getPurchaseOrder(session.companyId, poId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{po.poNo}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {PO_STATUS_LABEL[po.status] ?? po.status} · {supplierName} · Toplam: {Number(total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {po.currencyCode}
        {po.deliveryLocation ? ` · Teslimat: ${po.deliveryLocation}` : ''}
        {po.paymentTerms ? ` · Ödeme: ${po.paymentTerms}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {po.status === 'DRAFT' ? <IssuePoButton poId={poId} /> : null}
        {po.status === 'ISSUED' ? <AcknowledgePoButton poId={poId} /> : null}
        {po.status === 'DRAFT' || po.status === 'ISSUED' ? <CancelPoButton poId={poId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kalemler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Açıklama</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birim Fiyat</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.quantity).toLocaleString('tr-TR')} {l.unitCode}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(l.lineTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Sözleşme / Ek Dosyalar</h2>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        {attachments.map((a) => <div key={a.id}>{a.fileName}</div>)}
        {attachments.length === 0 ? <span style={{ color: '#999' }}>Henüz dosya yok.</span> : null}
      </div>
      <PoAttachmentForm poId={poId} />
    </div>
  );
}
