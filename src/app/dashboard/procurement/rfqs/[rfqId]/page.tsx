import { requireSession } from '@/lib/dal';
import { getRfq, getRfqComparison } from '@/lib/procurement/rfq';
import { QuotationForm, SendRfqButton, CloseRfqButton } from '@/components/procurement/quotation-form';

const RFQ_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SENT: 'Gönderildi', CLOSED: 'Kapandı', CANCELLED: 'İptal' };
const SUPPLIER_STATUS_LABEL: Record<string, string> = { INVITED: 'Davet Edildi', RESPONDED: 'Teklif Verdi', DECLINED: 'Reddetti' };

export default async function RfqDetailPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const session = await requireSession();
  const [{ rfq, lines, suppliers }, comparison] = await Promise.all([
    getRfq(session.companyId, rfqId),
    getRfqComparison(session.companyId, rfqId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{rfq.rfqNo} — {rfq.title}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {RFQ_STATUS_LABEL[rfq.status] ?? rfq.status}
        {rfq.quotationDeadline ? ` · Son teklif: ${new Date(rfq.quotationDeadline).toLocaleString('tr-TR')}` : ''}
        {rfq.deliveryLocation ? ` · Teslimat: ${rfq.deliveryLocation}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {rfq.status === 'DRAFT' ? <SendRfqButton rfqId={rfqId} /> : null}
        {rfq.status === 'SENT' ? <CloseRfqButton rfqId={rfqId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kalemler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Açıklama</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Birim</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.quantity).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{l.unitCode}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tedarikçiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Tedarikçi</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{s.supplierName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{SUPPLIER_STATUS_LABEL[s.status] ?? s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rfq.status === 'SENT' ? (
        <div style={{ marginBottom: 24 }}>
          <QuotationForm rfqId={rfqId} rfqLines={lines.map((l) => ({ id: l.id, description: l.description }))} suppliers={suppliers.map((s) => ({ id: s.supplierPartyId, legalName: s.supplierName }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teklif Karşılaştırması</h2>
      <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Her tedarikçinin EN SON teklif versiyonu kullanılır, en ucuzdan pahalıya sıralanır.</p>
      {comparison.map((row) => (
        <div key={row.rfqLineId} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{row.description} ({Number(row.quantity).toLocaleString('tr-TR')})</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '4px 8px' }}>Tedarikçi</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Birim Fiyat</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>İndirim</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Net Birim</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Toplam</th>
                <th style={{ padding: '4px 8px' }}>Teslim</th>
              </tr>
            </thead>
            <tbody>
              {row.cells.map((c, i) => (
                <tr key={c.supplierPartyId} style={{ borderBottom: '1px solid #f0f0f0', background: i === 0 ? '#f4fbf4' : undefined }}>
                  <td style={{ padding: '4px 8px' }}>{c.supplierName}{c.isAlternative ? ' (Alternatif)' : ''}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{c.unitPrice}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>%{c.discountPercent}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{c.netUnitPrice}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: i === 0 ? 600 : 400 }}>{c.lineTotal}</td>
                  <td style={{ padding: '4px 8px', color: '#666' }}>{c.deliveryDays ?? '—'} gün</td>
                </tr>
              ))}
              {row.cells.length === 0 ? <tr><td colSpan={6} style={{ padding: '6px 8px', color: '#999' }}>Henüz teklif yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
