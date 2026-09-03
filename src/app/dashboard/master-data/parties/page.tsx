import Link from 'next/link';
import { requireFactoryAdmin } from '@/lib/dal';
import { listParties, listPaymentTerms } from '@/lib/master-data/parties';
import { listCurrencies } from '@/lib/master-data/currency';
import { PartyForm } from '@/components/master-data/party-form';

export default async function PartiesPage() {
  const session = await requireFactoryAdmin();
  const [parties, currencies, paymentTerms] = await Promise.all([
    listParties(session.companyId),
    listCurrencies(),
    listPaymentTerms(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Cariler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Müşteri/Tedarikçi ortak kartı (PARTY modeli) — bir cari her iki role de sahip olabilir.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Unvan</th>
            <th style={{ padding: '6px 8px' }}>VKN/TCKN</th>
            <th style={{ padding: '6px 8px' }}>Roller</th>
            <th style={{ padding: '6px 8px' }}>E-posta</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/master-data/parties/${p.id}`}>{p.code}</Link></td>
              <td style={{ padding: '6px 8px' }}>{p.legalName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.taxNumber || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.roles.map((r) => (r === 'CUSTOMER' ? 'Müşteri' : 'Tedarikçi')).join(', ') || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{p.email || '—'}</td>
            </tr>
          ))}
          {parties.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz cari kartı yok.</td></tr> : null}
        </tbody>
      </table>

      <PartyForm currencies={currencies} paymentTerms={paymentTerms} />
    </div>
  );
}
