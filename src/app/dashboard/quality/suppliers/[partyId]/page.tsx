import { requireSession } from '@/lib/dal';
import { getSupplierQualityScore } from '@/lib/quality/supplier-score';

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${(value * 100).toFixed(1)}`;
}

export default async function SupplierQualityPage({ params, searchParams }: { params: Promise<{ partyId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { partyId } = await params;
  const { from, to } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || ninetyDaysAgo;
  const toDate = to || today;

  const score = await getSupplierQualityScore(session.companyId, partyId, fromDate, toDate);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{score.supplierName} — Tedarikçi Kalite</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Giriş muayenesi kabul oranı ve NCR geçmişi, talep üzerine hesaplanır — saklanan bir skor DEĞİL.</p>

      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Giriş Muayene Kabul Oranı" value={formatPercent(score.incomingPassRate)} big />
        <Stat label="Muayene Sayısı" value={String(score.incomingInspectionCount)} />
        <Stat label="Kabul Edilen" value={String(score.incomingPassCount)} />
        <Stat label="Toplam NCR" value={String(score.ncrCount)} />
        <Stat label="Açık NCR" value={String(score.openNcrCount)} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>NCR Önem Dağılımı</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stat label="Düşük" value={String(score.ncrBySeverity.MINOR)} />
        <Stat label="Orta" value={String(score.ncrBySeverity.MAJOR)} />
        <Stat label="Kritik" value={String(score.ncrBySeverity.CRITICAL)} />
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', minWidth: 110 }}>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}
