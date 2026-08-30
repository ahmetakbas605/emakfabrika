import { requireSession } from '@/lib/dal';
import { listQuotes } from '@/lib/sales/quotes';
import { listParties } from '@/lib/master-data/parties';
import { listProducts } from '@/lib/master-data/products';
import { CreateQuoteForm, QuoteStatusButtons } from '@/components/sales/quote-forms';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SENT: 'Gönderildi', ACCEPTED: 'Kabul Edildi', REJECTED: 'Reddedildi', EXPIRED: 'Süresi Doldu', CONVERTED: 'Siparişe Dönüştü' };

export default async function QuotesPage() {
  const session = await requireSession();
  const [quotes, parties, products] = await Promise.all([listQuotes(session.companyId), listParties(session.companyId), listProducts(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Teklifler</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Kabul edilen bir teklif, satırlarıyla birlikte doğrudan bir Siparişe dönüştürülür.</p>

      <div style={{ marginBottom: 20 }}><CreateQuoteForm parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Cari</th><th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{q.quoteNo}</td>
              <td style={{ padding: '6px 8px' }}>{q.partyName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{q.quoteDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[q.status] ?? q.status}</td>
              <td style={{ padding: '6px 8px' }}><QuoteStatusButtons quoteId={q.id} status={q.status} /></td>
            </tr>
          ))}
          {quotes.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz teklif yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
