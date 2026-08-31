import { requireSession } from '@/lib/dal';
import { getMachine } from '@/lib/mes/machines';
import { getMachineOeeSummary } from '@/lib/mes/oee';
import { listMachineDowntimes } from '@/lib/mes/downtime';

function formatPercent(value: number | null): string {
  return value === null ? '—' : `%${(value * 100).toFixed(1)}`;
}
function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(2)} sa`;
}

export default async function MachineOeePage({ params, searchParams }: { params: Promise<{ machineId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { machineId } = await params;
  const { from, to } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || thirtyDaysAgo;
  const toDate = to || today;

  const machine = await getMachine(session.companyId, machineId);
  const [summary, downtimes] = await Promise.all([getMachineOeeSummary(session.companyId, machineId, fromDate, toDate), listMachineDowntimes(session.companyId, machineId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{machine.code} — {machine.name}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>İdeal çevrim süresi: {machine.idealCycleTimeSeconds ?? 'tanımlı değil'} sn/adet {!machine.idealCycleTimeSeconds ? '(Performance/OEE hesaplanamaz — sadece Availability/Quality gösterilir)' : ''}</p>

      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="OEE" value={formatPercent(summary.oee)} big />
        <Stat label="Kullanılabilirlik" value={formatPercent(summary.availability)} />
        <Stat label="Performans" value={formatPercent(summary.performance)} />
        <Stat label="Kalite" value={formatPercent(summary.quality)} />
        <Stat label="Tamamlanan Operasyon" value={String(summary.operationCount)} />
        <Stat label="Toplam Süre" value={formatHours(summary.totalTimeSeconds)} />
        <Stat label="Duruş Süresi" value={formatHours(summary.downtimeSeconds)} />
        <Stat label="İyi / Fire" value={`${summary.goodQuantity} / ${summary.scrapQuantity}`} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Duruş Geçmişi</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Neden</th><th style={{ padding: '6px 8px' }}>Kategori</th><th style={{ padding: '6px 8px' }}>Başlangıç</th><th style={{ padding: '6px 8px' }}>Bitiş</th><th style={{ padding: '6px 8px' }}>Not</th>
          </tr>
        </thead>
        <tbody>
          {downtimes.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{d.reasonName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{d.category === 'PLANNED' ? 'Planlı' : 'Plansız'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(d.startedAt).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{d.endedAt ? new Date(d.endedAt).toLocaleString('tr-TR') : <span style={{ color: '#b00' }}>Devam ediyor</span>}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{d.notes ?? '—'}</td>
            </tr>
          ))}
          {downtimes.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz duruş kaydı yok.</td></tr> : null}
        </tbody>
      </table>
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
