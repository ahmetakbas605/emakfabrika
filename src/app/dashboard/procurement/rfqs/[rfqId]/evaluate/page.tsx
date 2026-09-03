import { requireSession } from '@/lib/dal';
import { getRfq } from '@/lib/procurement/rfq';
import { getRfqEvaluation } from '@/lib/procurement/evaluation';
import { TechnicalEvaluationForm, CommercialEvaluationForm } from '@/components/procurement/evaluation-form';

const TECH_STATUS_LABEL: Record<string, string> = { COMPLIANT: 'Uygun', PARTIALLY_COMPLIANT: 'Kısmen Uygun', ALTERNATIVE_ACCEPTED: 'Alternatif Kabul', NON_COMPLIANT: 'Uygun Değil', REJECTED: 'Reddedildi' };

export default async function RfqEvaluatePage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const session = await requireSession();
  const [{ rfq }, { rows, weights }] = await Promise.all([
    getRfq(session.companyId, rfqId),
    getRfqEvaluation(session.companyId, rfqId)
  ]);

  // Ticari değerlendirme tedarikçinin TEKLİFİ bazında bir kez yapılır
  // (satır bazında değil) — quotationId'ye göre TEKİL liste çıkar.
  const commercialTargets = new Map<string, { quotationId: string; supplierName: string; score: number | null; notes: string | null }>();
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.quotationId && !commercialTargets.has(cell.quotationId)) {
        commercialTargets.set(cell.quotationId, { quotationId: cell.quotationId, supplierName: cell.supplierName, score: cell.commercialScore, notes: cell.commercialNotes });
      }
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{rfq.rfqNo} — Değerlendirme</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Ağırlıklar: Fiyat %{weights.priceWeight} · Teknik %{weights.technicalWeight} · Teslimat %{weights.deliveryWeight} · Ticari %{weights.commercialWeight}.
        Eksik bileşenler ortalamadan hariç tutulur; kalan ağırlıklar yeniden normalize edilir.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ticari Değerlendirme (Teklif Bazında)</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[...commercialTargets.values()].map((t) => (
          <div key={t.quotationId} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 10, minWidth: 200 }}>
            <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{t.supplierName}</p>
            <CommercialEvaluationForm rfqId={rfqId} quotationId={t.quotationId} initial={t.score !== null ? { score: t.score, notes: t.notes } : undefined} />
          </div>
        ))}
        {commercialTargets.size === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Henüz teklif yok.</p> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teknik Değerlendirme ve Ağırlıklı Skor (Satır Bazında)</h2>
      {rows.map((row) => (
        <div key={row.rfqLineId} style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{row.description}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border-soft)' }}>
                <th style={{ padding: '4px 8px' }}>Tedarikçi</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Fiyat Skoru</th>
                <th style={{ padding: '4px 8px' }}>Teknik Değerlendirme</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Teslimat Skoru</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Ticari Skoru</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Ağırlıklı Toplam</th>
              </tr>
            </thead>
            <tbody>
              {row.cells.map((cell, i) => (
                <tr key={cell.supplierPartyId} style={{ borderBottom: '1px solid var(--dim-border-soft)', background: i === 0 && cell.weightedTotal !== null ? '#f4fbf4' : undefined }}>
                  <td style={{ padding: '4px 8px' }}>{cell.supplierName}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{cell.priceScore ?? '—'}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {cell.quotationLineId ? (
                      <>
                        {cell.technicalStatus ? (
                          <p style={{ margin: '0 0 4px', fontSize: 12 }}>
                            {TECH_STATUS_LABEL[cell.technicalStatus] ?? cell.technicalStatus}
                            {cell.technicalReason ? ` — ${cell.technicalReason}` : ''}
                          </p>
                        ) : null}
                        <TechnicalEvaluationForm rfqId={rfqId} quotationLineId={cell.quotationLineId} initial={cell.technicalStatus ? { complianceStatus: cell.technicalStatus, reason: cell.technicalReason } : undefined} />
                      </>
                    ) : <span style={{ color: 'var(--dim-slate)' }}>Teklif yok</span>}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{cell.deliveryScore ?? '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{cell.commercialScore ?? '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: i === 0 ? 600 : 400 }}>{cell.weightedTotal ?? '—'}</td>
                </tr>
              ))}
              {row.cells.length === 0 ? <tr><td colSpan={6} style={{ padding: '6px 8px', color: 'var(--dim-slate)' }}>Henüz teklif yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
