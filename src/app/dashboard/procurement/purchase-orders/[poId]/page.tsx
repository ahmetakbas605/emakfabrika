import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { getPurchaseOrder } from '@/lib/procurement/purchaseOrder';
import { getPoReceivingStatus, listReceiptsForPo, listVendorInvoicesForPo } from '@/lib/procurement/receiving';
import { listWarehouses, listStockItems } from '@/lib/warehouse';
import { IssuePoButton, AcknowledgePoButton, CancelPoButton, PoAttachmentForm } from '@/components/procurement/po-actions';
import { GoodsReceiptForm, VendorInvoiceForm } from '@/components/procurement/receiving-form';

const PO_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', ISSUED: 'Gönderildi', ACKNOWLEDGED: 'Tedarikçi Onayladı', CANCELLED: 'İptal' };
const INVOICE_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', CANCELLED: 'İptal' };

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ poId: string }> }) {
  const { poId } = await params;
  const session = await requireSession();
  const { po, supplierName, lines, total, attachments } = await getPurchaseOrder(session.companyId, poId);
  const canReceive = po.status === 'ISSUED' || po.status === 'ACKNOWLEDGED';

  const [receivingStatus, receipts, invoices, warehouses, stockItems] = await Promise.all([
    getPoReceivingStatus(session.companyId, poId),
    listReceiptsForPo(session.companyId, poId),
    listVendorInvoicesForPo(session.companyId, poId),
    canReceive ? listWarehouses(session.companyId) : Promise.resolve([]),
    canReceive ? listStockItems(session.companyId) : Promise.resolve([])
  ]);
  const receivableLines = receivingStatus.filter((l) => Number(l.remainingQty) > 0);

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

      <h2 style={{ fontSize: 16, margin: '24px 0 8px' }}>Mal Kabul Durumu</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kalem</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Sipariş</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Kabul Edilen</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Kalan</th>
          </tr>
        </thead>
        <tbody>
          {receivingStatus.map((l) => (
            <tr key={l.poLineId} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.orderedQty).toLocaleString('tr-TR')} {l.unitCode}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#080' }}>{Number(l.receivedQty).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: Number(l.remainingQty) > 0 ? '#b70' : '#999' }}>{Number(l.remainingQty).toLocaleString('tr-TR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {receipts.length > 0 ? (
        <div style={{ marginBottom: 16, fontSize: 12 }}>
          {receipts.map((r) => (
            <div key={r.id} style={{ marginBottom: 6 }}>
              <b>{r.receiptNo}</b> — {new Date(r.receiptDate).toLocaleDateString('tr-TR')}
              {r.lines.map((l) => <div key={l.id} style={{ color: '#666', marginLeft: 12 }}>{l.description}: {Number(l.receivedQty).toLocaleString('tr-TR')} {l.unitCode}</div>)}
            </div>
          ))}
        </div>
      ) : null}

      {canReceive && receivableLines.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <GoodsReceiptForm
            poId={poId}
            lines={receivableLines.map((l) => ({ poLineId: l.poLineId, description: l.description, unitCode: l.unitCode, remainingQty: l.remainingQty }))}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
            stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name }))}
          />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tedarikçi Faturaları</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        {invoices.map((inv) => (
          <Link key={inv.id} href={`/dashboard/procurement/vendor-invoices/${inv.id}`} style={{ fontSize: 13, color: '#111' }}>
            {inv.supplierInvoiceNo} — {new Date(inv.invoiceDate).toLocaleDateString('tr-TR')} ({INVOICE_STATUS_LABEL[inv.status] ?? inv.status})
          </Link>
        ))}
        {invoices.length === 0 ? <span style={{ color: '#999', fontSize: 13 }}>Henüz fatura yok.</span> : null}
      </div>

      {canReceive ? (
        <VendorInvoiceForm poId={poId} currencyCode={po.currencyCode} lines={lines.map((l) => ({ poLineId: l.id, description: l.description, unitCode: l.unitCode, unitPrice: l.unitPrice }))} />
      ) : null}
    </div>
  );
}
