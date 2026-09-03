import { requireSession } from '@/lib/dal';
import { getOrder } from '@/lib/sales/orders';
import { getParty } from '@/lib/master-data/parties';
import { listShipments } from '@/lib/sales/shipments';
import { listInvoices, getInvoice } from '@/lib/sales/invoices';
import { listCollections, getInvoiceCollectionSummary } from '@/lib/sales/collections';
import { listWarehouses } from '@/lib/warehouse';
import { money } from '@/lib/money';
import { SubmitOrderButton, CancelOrderButton } from '@/components/sales/order-forms';
import { CreateShipmentForm, DispatchShipmentButton, MarkShipmentDeliveredButton, CancelShipmentButton } from '@/components/sales/shipment-forms';
import { CreateInvoiceFromOrderForm, ApproveInvoiceForm, CancelInvoiceButton } from '@/components/sales/invoice-forms';
import { CreateCollectionForm } from '@/components/sales/collection-forms';

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', SUBMITTED: 'Onayda', CONFIRMED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli',
  IN_FULFILLMENT: 'Kısmen Sevk Edildi', SHIPPED: 'Sevk Edildi', INVOICED: 'Faturalandı', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal'
};
const SHIPMENT_STATUS_LABELS: Record<string, string> = { DRAFT: 'Hazırlandı', SHIPPED: 'Sevk Edildi', DELIVERED: 'Teslim Edildi', CANCELLED: 'İptal' };
const INVOICE_STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', CANCELLED: 'İptal' };

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await requireSession();
  const { order, lines } = await getOrder(session.companyId, orderId);
  const [party, warehouses, shipments, allInvoices] = await Promise.all([
    getParty(session.companyId, order.partyId),
    listWarehouses(session.companyId),
    listShipments(session.companyId, orderId),
    listInvoices(session.companyId)
  ]);
  const orderInvoices = (await Promise.all(allInvoices.map((i) => getInvoice(session.companyId, i.id)))).filter((i) => i.invoice.orderId === orderId);

  const shipmentLinesForForm = lines
    .map((l) => ({ id: l.id, productName: l.productName, remaining: money(l.quantity).minus(l.shippedQuantity).toFixed(2) }))
    .filter((l) => Number(l.remaining) > 0);
  const invoiceLinesForForm = lines
    .map((l) => ({ id: l.id, productId: l.productId, productName: l.productName, unitPrice: l.unitPrice, taxRatePercent: l.taxRatePercent, remaining: money(l.quantity).minus(l.invoicedQuantity).toFixed(2) }))
    .filter((l) => Number(l.remaining) > 0);

  const canShip = order.status === 'CONFIRMED' || order.status === 'IN_FULFILLMENT';
  const canInvoice = order.status === 'CONFIRMED' || order.status === 'IN_FULFILLMENT' || order.status === 'SHIPPED';

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{order.orderNo}</h1>
        <span style={{ fontWeight: 600 }}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>{party.party.legalName} · {order.orderDate} · {order.currencyCode}</p>

      {order.status === 'DRAFT' || order.status === 'REVISION_REQUIRED' ? (
        <div style={{ marginBottom: 20 }}>
          <SubmitOrderButton orderId={order.id} />
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kalemler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birim Fiyat</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Kalem Toplamı</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Sevk Edilen</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Faturalanan</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{l.productName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.quantity}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.unitPrice}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.lineTotal}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{l.shippedQuantity}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{l.invoicedQuantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sevkiyatlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th></tr></thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.shipmentNo}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.shipmentDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{SHIPMENT_STATUS_LABELS[s.status] ?? s.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {s.status === 'DRAFT' ? <><DispatchShipmentButton shipmentId={s.id} /><CancelShipmentButton shipmentId={s.id} /></> : null}
                {s.status === 'SHIPPED' ? <MarkShipmentDeliveredButton shipmentId={s.id} /> : null}
              </td>
            </tr>
          ))}
          {shipments.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz sevkiyat yok.</td></tr> : null}
        </tbody>
      </table>
      {canShip && shipmentLinesForForm.length > 0 ? <div style={{ marginBottom: 24 }}><CreateShipmentForm orderId={order.id} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} lines={shipmentLinesForForm} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Faturalar</h2>
      {orderInvoices.map(({ invoice, lines: invLines }) => (
        <div key={invoice.id} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 4, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span style={{ fontFamily: 'monospace' }}>{invoice.invoiceNo}</span>
            <span style={{ fontWeight: 600 }}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</span>
          </div>
          <ul style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)', paddingLeft: 18, marginBottom: 6 }}>
            {invLines.map((l) => <li key={l.id}>{l.productName} — {l.quantity} × {l.unitPrice} (%{l.taxRatePercent} KDV)</li>)}
          </ul>
          {invoice.status === 'DRAFT' ? <><ApproveInvoiceForm invoiceId={invoice.id} /> <CancelInvoiceButton invoiceId={invoice.id} /></> : null}
          {invoice.status === 'APPROVED' ? <SalesInvoiceCollections companyId={session.companyId} invoiceId={invoice.id} currencyCode={invoice.currencyCode} /> : null}
        </div>
      ))}
      {canInvoice && invoiceLinesForForm.length > 0 ? <CreateInvoiceFromOrderForm orderId={order.id} partyId={order.partyId} currencyCode={order.currencyCode} lines={invoiceLinesForForm} /> : null}
    </div>
  );
}

async function SalesInvoiceCollections({ companyId, invoiceId, currencyCode }: { companyId: string; invoiceId: string; currencyCode: string }) {
  const [collections, summary] = await Promise.all([listCollections(companyId, invoiceId), getInvoiceCollectionSummary(companyId, invoiceId)]);
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 6 }}>Fatura Toplamı: {summary.invoiceTotal} · Tahsil Edilen: {summary.collected} · Kalan: {summary.remaining}</p>
      <ul style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)', paddingLeft: 18, marginBottom: 6 }}>
        {collections.map((c) => <li key={c.id}>{c.collectionDate} — {c.amount} {c.currencyCode} ({c.method})</li>)}
      </ul>
      {Number(summary.remaining) > 0 ? <CreateCollectionForm invoiceId={invoiceId} currencyCode={currencyCode} /> : null}
    </div>
  );
}
