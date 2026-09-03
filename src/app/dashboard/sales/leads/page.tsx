import { requireSession } from '@/lib/dal';
import { listLeads } from '@/lib/sales/leads';
import { listParties } from '@/lib/master-data/parties';
import { CreateLeadForm, LeadStatusButtons, ConvertLeadForm } from '@/components/sales/lead-forms';

const STATUS_LABELS: Record<string, string> = { NEW: 'Yeni', CONTACTED: 'İletişime Geçildi', QUALIFIED: 'Kalifiye', DISQUALIFIED: 'Kalifiye Değil', CONVERTED: 'Dönüştürüldü' };

export default async function LeadsPage() {
  const session = await requireSession();
  const [leads, parties] = await Promise.all([listLeads(session.companyId), listParties(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Aday Müşteriler (Lead)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Kalifiye olan bir aday müşteri, bir cari karta (Müşteri rolüyle) ve bir Fırsata dönüştürülür.</p>

      <div style={{ marginBottom: 20 }}><CreateLeadForm /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>İletişim</th><th style={{ padding: '6px 8px' }}>Şirket</th><th style={{ padding: '6px 8px' }}>Kaynak</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--dim-border-soft)', verticalAlign: 'top' }}>
              <td style={{ padding: '6px 8px' }}>{l.contactName}<br /><span style={{ color: 'var(--dim-slate)', fontSize: 11 }}>{l.email} {l.phone}</span></td>
              <td style={{ padding: '6px 8px' }}>{l.companyName || '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{l.source || '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[l.status] ?? l.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {l.status !== 'CONVERTED' && l.status !== 'DISQUALIFIED' ? (
                  <>
                    <LeadStatusButtons leadId={l.id} currentStatus={l.status} />
                    {l.status === 'QUALIFIED' ? <ConvertLeadForm leadId={l.id} parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} /> : null}
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {leads.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz aday müşteri yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
