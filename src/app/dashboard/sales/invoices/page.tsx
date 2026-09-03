import { requireSession } from '@/lib/dal';
import { listInvoices } from '@/lib/sales/invoices';
import { ApproveInvoiceForm, CancelInvoiceButton } from '@/components/sales/invoice-forms';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', APPROVED: 'Onaylandı', CANCELLED: 'İptal' };

export default async function SalesInvoicesPage() {
  const session = await requireSession();
  const invoices = await listInvoices(session.companyId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Satış Faturaları</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Faturalar genellikle bir siparişin detay sayfasından (kalemlerinden) oluşturulur — bkz. Siparişler.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Cari</th><th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{i.invoiceNo}</td>
              <td style={{ padding: '6px 8px' }}>{i.partyName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{i.invoiceDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[i.status] ?? i.status}</td>
              <td style={{ padding: '6px 8px' }}>{i.status === 'DRAFT' ? <><ApproveInvoiceForm invoiceId={i.id} /> <CancelInvoiceButton invoiceId={i.id} /></> : null}</td>
            </tr>
          ))}
          {invoices.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz fatura yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
