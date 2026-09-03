import { requireSession } from '@/lib/dal';
import { listEnergyMeters, listEnergyReadings, getEnergyPerUnit } from '@/lib/eam/energy';
import { listEamAssets } from '@/lib/eam/assets';
import { listWorkCenters } from '@/lib/production/workcenters';
import { CreateEnergyMeterForm, RecordEnergyReadingForm } from '@/components/eam/eam-forms';

const ENERGY_TYPE_LABELS: Record<string, string> = { ELECTRICITY: 'Elektrik', NATURAL_GAS: 'Doğalgaz', WATER: 'Su', STEAM: 'Buhar', COMPRESSED_AIR: 'Basınçlı Hava' };

export default async function EnergyPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; workCenterId?: string }> }) {
  const { from, to, workCenterId } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || ninetyDaysAgo;
  const toDate = to || today;

  const [meters, readings, workCenters, assets] = await Promise.all([
    listEnergyMeters(session.companyId), listEnergyReadings(session.companyId), listWorkCenters(session.companyId), listEamAssets(session.companyId)
  ]);

  const selectedWorkCenterId = workCenterId || workCenters[0]?.id;
  const perUnit = selectedWorkCenterId ? await getEnergyPerUnit(session.companyId, selectedWorkCenterId, fromDate, toDate) : null;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Enerji Tüketimi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Elektrik/doğalgaz/su/buhar/basınçlı hava — dönem bazlı tüketim kaydı. Ürün-başı enerji, bir iş merkezine bağlı sayaçlar için talep üzerine hesaplanır.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sayaç Ekle</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateEnergyMeterForm workCenters={workCenters.map((w) => ({ id: w.id, code: w.code, name: w.name }))} assets={assets.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sayaçlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Birim</th><th style={{ padding: '6px 8px' }}>İş Merkezi</th></tr></thead>
        <tbody>
          {meters.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{m.code}</td>
              <td style={{ padding: '6px 8px' }}>{m.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{ENERGY_TYPE_LABELS[m.energyType]}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{m.unit}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{m.workCenterName ?? '—'}</td>
            </tr>
          ))}
          {meters.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz sayaç yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tüketim Kaydet</h2>
      {meters.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13, marginBottom: 24 }}>Önce en az bir sayaç eklenmeli.</p>
      ) : (
        <div style={{ marginBottom: 24 }}><RecordEnergyReadingForm meters={meters.map((m) => ({ id: m.id, code: m.code, name: m.name }))} /></div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tüketim Kayıtları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}><th style={{ padding: '6px 8px' }}>Sayaç</th><th style={{ padding: '6px 8px' }}>Dönem</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tüketim</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Maliyet</th></tr></thead>
        <tbody>
          {readings.slice(0, 20).map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{r.meterName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.periodStart} — {r.periodEnd}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{r.consumption} {r.unit}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{r.cost ?? '—'}</td>
            </tr>
          ))}
          {readings.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz tüketim kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      {workCenters.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ürün-Başı Enerji</h2>
          <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İş Merkezi</label>
              <select name="workCenterId" defaultValue={selectedWorkCenterId} style={{ padding: 6, minWidth: 140 }}>
                {workCenters.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
            <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
          </form>

          {perUnit ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Stat label="Toplam Tüketim" value={String(perUnit.totalConsumption)} />
              <Stat label="Toplam Maliyet" value={String(perUnit.totalCost)} />
              <Stat label="İyi Üretim (adet)" value={String(perUnit.totalGoodQuantity)} />
              <Stat label="Ürün-Başı Enerji" value={perUnit.energyPerUnit === null ? '—' : perUnit.energyPerUnit.toFixed(4)} big />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: '10px 16px', minWidth: 110 }}>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>{label}</div>
    </div>
  );
}
