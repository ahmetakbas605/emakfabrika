import { requireSession } from '@/lib/dal';
import { listRisks } from '@/lib/legal/risks';
import { CreateRiskForm, UpdateRiskAssessmentForm, StartRiskMitigationButton, CloseRiskButton } from '@/components/legal/legal-forms';

const CATEGORY_LABELS: Record<string, string> = { LEGAL: 'Hukuki', FINANCIAL: 'Mali', OPERATIONAL: 'Operasyonel', STRATEGIC: 'Stratejik', COMPLIANCE: 'Uyum', OTHER: 'Diğer' };
const STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', MITIGATING: 'Azaltılıyor', CLOSED: 'Kapatıldı' };

function scoreColor(score: number): string {
  if (score >= 15) return '#b00';
  if (score >= 8) return '#a60';
  return '#080';
}

export default async function RiskRegisterPage() {
  const session = await requireSession();
  const risks = await listRisks(session.companyId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Risk Kaydı</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Skor = Olasılık × Etki, her zaman otomatik hesaplanır — elle girilemez. En yüksek skorlu risk en üstte.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Risk Kaydı Oluştur</h2>
      <div style={{ marginBottom: 24 }}><CreateRiskForm /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Riskler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Kategori</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Skor</th><th style={{ padding: '6px 8px' }}>Sorumlu</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {risks.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.riskNo}</td>
              <td style={{ padding: '6px 8px' }}>{r.title}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{CATEGORY_LABELS[r.category]}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: scoreColor(r.score) }}>{r.score} <span style={{ fontSize: 11, color: '#999' }}>({r.probability}×{r.impact})</span></td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{r.ownerName ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[r.status]}</td>
              <td style={{ padding: '6px 8px' }}>
                {r.status !== 'CLOSED' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <UpdateRiskAssessmentForm riskId={r.id} probability={r.probability} impact={r.impact} mitigation={null} />
                    <div>
                      {r.status === 'OPEN' ? <StartRiskMitigationButton riskId={r.id} /> : null}
                      <CloseRiskButton riskId={r.id} />
                    </div>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
          {risks.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Henüz risk kaydı yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
