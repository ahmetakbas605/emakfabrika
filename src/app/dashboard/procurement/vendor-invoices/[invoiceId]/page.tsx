import { requireSession } from '@/lib/dal';
import { getVendorInvoice } from '@/lib/procurement/receiving';
import { ApproveInvoiceForm, CancelInvoiceButton } from '@/components/procurement/receiving-form';

const INVOICE_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', CANCELLED: 'İptal' };

export default async function VendorInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const session = await requireSession();
  const { invoice, lines, total, fullyMatched, tolerancePercent } = await getVendorInvoice(session.companyId, invoiceId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{invoice.supplierInvoiceNo}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status} · {new Date(invoice.invoiceDate).toLocaleDateString('tr-TR')} · Toplam: {Number(total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currencyCode}
        {' · '}
        <span style={{ color: fullyMatched ? '#080' : '#b00', fontWeight: 600 }}>{fullyMatched ? 'Eşleşti' : `Fiyat Sapması (>%${tolerancePercent})`}</span>
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {invoice.status === 'DRAFT' ? <ApproveInvoiceForm invoiceId={invoiceId} /> : null}
        {invoice.status === 'DRAFT' ? <CancelInvoiceButton invoiceId={invoiceId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>3-Way Match — Kalemler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Açıklama</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Faturalanan</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Fatura Fiyatı</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>PO Fiyatı</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Sapma</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.invoicedQty).toLocaleString('tr-TR')} {l.unitCode}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.invoicedUnitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{Number(l.poUnitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: l.withinTolerance ? '#080' : '#b00', fontWeight: l.withinTolerance ? 400 : 600 }}>%{l.priceVariancePercent}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(l.lineTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
