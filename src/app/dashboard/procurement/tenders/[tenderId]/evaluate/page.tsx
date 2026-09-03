import { requireSession } from '@/lib/dal';
import { getTender } from '@/lib/procurement/tender';
import { getTenderEvaluation } from '@/lib/procurement/evaluation';
import { TenderTechnicalEvaluationForm, TenderCommercialEvaluationForm } from '@/components/procurement/tender-evaluation-form';

const TECH_STATUS_LABEL: Record<string, string> = { COMPLIANT: 'Uygun', PARTIALLY_COMPLIANT: 'Kısmen Uygun', ALTERNATIVE_ACCEPTED: 'Alternatif Kabul', NON_COMPLIANT: 'Uygun Değil', REJECTED: 'Reddedildi' };

export default async function TenderEvaluatePage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  const session = await requireSession();
  const [{ tender }, { rows, weights }] = await Promise.all([
    getTender(session.companyId, tenderId),
    getTenderEvaluation(session.companyId, tenderId)
  ]);

  // Ticari değerlendirme tedarikçinin TEKLİFİ bazında bir kez yapılır
  // (satır bazında değil) — tenderBidId'ye göre TEKİL liste çıkar.
  const commercialTargets = new Map<string, { tenderBidId: string; supplierName: string; score: number | null; notes: string | null }>();
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.tenderBidId && !commercialTargets.has(cell.tenderBidId)) {
        commercialTargets.set(cell.tenderBidId, { tenderBidId: cell.tenderBidId, supplierName: cell.supplierName, score: cell.commercialScore, notes: cell.commercialNotes });
      }
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{tender.tenderNo} — Değerlendirme</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Ağırlıklar: Fiyat %{weights.priceWeight} · Teknik %{weights.technicalWeight} · Teslimat %{weights.deliveryWeight} · Ticari %{weights.commercialWeight}.
        Eksik bileşenler ortalamadan hariç tutulur; kalan ağırlıklar yeniden normalize edilir.
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Ticari Değerlendirme (Teklif Bazında)</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[...commercialTargets.values()].map((t) => (
          <div key={t.tenderBidId} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 10, minWidth: 200 }}>
            <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{t.supplierName}</p>
            <TenderCommercialEvaluationForm tenderId={tenderId} tenderBidId={t.tenderBidId} initial={t.score !== null ? { score: t.score, notes: t.notes } : undefined} />
          </div>
        ))}
        {commercialTargets.size === 0 ? <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Henüz teklif yok.</p> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teknik Değerlendirme ve Ağırlıklı Skor (Satır Bazında)</h2>
      {rows.map((row) => (
        <div key={row.tenderLineId} style={{ marginBottom: 20 }}>
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
                    {cell.tenderBidLineId ? (
                      <>
                        {cell.technicalStatus ? (
                          <p style={{ margin: '0 0 4px', fontSize: 12 }}>
                            {TECH_STATUS_LABEL[cell.technicalStatus] ?? cell.technicalStatus}
                            {cell.technicalReason ? ` — ${cell.technicalReason}` : ''}
                          </p>
                        ) : null}
                        <TenderTechnicalEvaluationForm tenderId={tenderId} tenderBidLineId={cell.tenderBidLineId} initial={cell.technicalStatus ? { complianceStatus: cell.technicalStatus, reason: cell.technicalReason } : undefined} />
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
