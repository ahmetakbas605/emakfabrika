import { requireFactoryAdmin } from '@/lib/dal';
import { listPaymentTerms } from '@/lib/master-data/parties';
import { PaymentTermForm } from '@/components/master-data/payment-term-form';

export default async function PaymentTermsPage() {
  const session = await requireFactoryAdmin();
  const terms = await listPaymentTerms(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ödeme Vadeleri</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Peşin, NET_7, NET_30 gibi parametrik vade tanımları (madde 38).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vade (gün)</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{t.code}</td>
              <td style={{ padding: '6px 8px' }}>{t.name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{t.netDays}</td>
            </tr>
          ))}
          {terms.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: '#999' }}>Henüz ödeme vadesi yok.</td></tr> : null}
        </tbody>
      </table>

      <PaymentTermForm />
    </div>
  );
}
