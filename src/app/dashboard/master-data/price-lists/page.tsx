import Link from 'next/link';
import { requireFactoryAdmin } from '@/lib/dal';
import { listPriceLists } from '@/lib/master-data/price-lists';
import { listCurrencies } from '@/lib/master-data/currency';
import { listParties } from '@/lib/master-data/parties';
import { PriceListForm } from '@/components/master-data/price-list-form';

export default async function PriceListsPage() {
  const session = await requireFactoryAdmin();
  const [lists, currencies, parties] = await Promise.all([
    listPriceLists(session.companyId),
    listCurrencies(),
    listParties(session.companyId, { role: 'CUSTOMER' })
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Fiyat Listeleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Genel liste veya müşteriye özel fiyatlandırma (madde 30-31).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Para Birimi</th>
            <th style={{ padding: '6px 8px' }}>Kapsam</th>
            <th style={{ padding: '6px 8px' }}>Geçerlilik</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/master-data/price-lists/${l.id}`}>{l.name}</Link></td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{l.currencyCode}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.partyName ?? 'Genel'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.validFrom ?? '—'} → {l.validTo ?? '—'}</td>
            </tr>
          ))}
          {lists.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz fiyat listesi yok.</td></tr> : null}
        </tbody>
      </table>

      <PriceListForm currencies={currencies} parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} />
    </div>
  );
}
