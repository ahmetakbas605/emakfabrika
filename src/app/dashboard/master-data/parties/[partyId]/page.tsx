import { requireFactoryAdmin } from '@/lib/dal';
import { getParty } from '@/lib/master-data/parties';
import { PartyAddressForm, PartyContactForm } from '@/components/master-data/party-detail-forms';

const ROLE_LABEL: Record<string, string> = { CUSTOMER: 'Müşteri', SUPPLIER: 'Tedarikçi' };
const ADDRESS_TYPE_LABEL: Record<string, string> = { BILLING: 'Fatura', SHIPPING: 'Sevkiyat', OTHER: 'Diğer' };

export default async function PartyDetailPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const session = await requireFactoryAdmin();
  const { party, roles, addresses, contacts } = await getParty(session.companyId, partyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{party.code} — {party.legalName}</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        {roles.map((r) => ROLE_LABEL[r] ?? r).join(', ') || 'Rolsüz'} · {party.taxNumber || 'VKN/TCKN yok'} · {party.email || 'e-posta yok'}
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Adresler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Etiket</th>
            <th style={{ padding: '6px 8px' }}>Adres</th>
            <th style={{ padding: '6px 8px' }}>İl/İlçe</th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{ADDRESS_TYPE_LABEL[a.addressType] ?? a.addressType}</td>
              <td style={{ padding: '6px 8px' }}>{a.label || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{a.addressLine || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{a.city} {a.district}</td>
            </tr>
          ))}
          {addresses.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz adres yok.</td></tr> : null}
        </tbody>
      </table>
      <div style={{ marginBottom: 24 }}><PartyAddressForm partyId={partyId} /></div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yetkililer</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad Soyad</th>
            <th style={{ padding: '6px 8px' }}>Unvan</th>
            <th style={{ padding: '6px 8px' }}>E-posta</th>
            <th style={{ padding: '6px 8px' }}>Telefon</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{c.fullName}{c.isPrimary ? ' ★' : ''}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.title || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.email || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.phone || '—'}</td>
            </tr>
          ))}
          {contacts.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz yetkili yok.</td></tr> : null}
        </tbody>
      </table>
      <PartyContactForm partyId={partyId} />
    </div>
  );
}
