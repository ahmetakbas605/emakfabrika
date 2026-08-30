import { requireSession } from '@/lib/dal';
import { listOpportunities } from '@/lib/sales/opportunities';
import { listParties } from '@/lib/master-data/parties';
import { CreateOpportunityForm, OpportunityStageButtons } from '@/components/sales/opportunity-forms';

const STAGE_LABELS: Record<string, string> = { NEW: 'Yeni', QUALIFICATION: 'Kalifikasyon', PROPOSAL: 'Teklif', NEGOTIATION: 'Pazarlık', WON: 'Kazanıldı', LOST: 'Kaybedildi' };

export default async function OpportunitiesPage() {
  const session = await requireSession();
  const [opportunities, parties] = await Promise.all([listOpportunities(session.companyId), listParties(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Fırsatlar (Opportunities)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Kazanılan (WON) bir fırsat, Teklif oluşturarak Sipariş'e ilerletilir.</p>

      <div style={{ marginBottom: 20 }}><CreateOpportunityForm parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Cari</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tahmini Değer</th>
            <th style={{ padding: '6px 8px' }}>Beklenen Kapanış</th><th style={{ padding: '6px 8px' }}>Aşama</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{o.name}</td>
              <td style={{ padding: '6px 8px' }}>{o.partyName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{o.estimatedValue ? `${Number(o.estimatedValue).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${o.currencyCode ?? ''}` : '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{o.expectedCloseDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STAGE_LABELS[o.stage] ?? o.stage}</td>
              <td style={{ padding: '6px 8px' }}>{o.stage !== 'WON' && o.stage !== 'LOST' ? <OpportunityStageButtons opportunityId={o.id} currentStage={o.stage} /> : null}</td>
            </tr>
          ))}
          {opportunities.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz fırsat yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
