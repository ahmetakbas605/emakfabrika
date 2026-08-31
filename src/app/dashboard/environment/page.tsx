import { requireSession } from '@/lib/dal';
import { listEnvPermits, listExpiringEnvPermits } from '@/lib/environment/permits';
import { listEmissions, listWaste, getEnvironmentalSummary } from '@/lib/environment/records';
import { CreateEnvPermitForm, RecordEmissionForm, RecordWasteForm } from '@/components/environment/environment-forms';

const PERMIT_TYPE_LABELS: Record<string, string> = { EMISSION: 'Emisyon', WASTE: 'Atık', WATER: 'Su', AIR: 'Hava', OTHER: 'Diğer' };
const PERMIT_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', EXPIRED: 'Süresi Doldu', RENEWAL_PENDING: 'Yenileme Bekliyor' };
const EMISSION_TYPE_LABELS: Record<string, string> = { CO2: 'CO2', NOX: 'NOx', SOX: 'SOx', PARTICULATE: 'Partikül', OTHER: 'Diğer' };
const WASTE_TYPE_LABELS: Record<string, string> = { HAZARDOUS: 'Tehlikeli', NON_HAZARDOUS: 'Tehlikesiz', RECYCLABLE: 'Geri Dönüştürülebilir' };

export default async function EnvironmentPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || ninetyDaysAgo;
  const toDate = to || today;

  const [permits, expiringPermits, emissions, wastes, summary] = await Promise.all([
    listEnvPermits(session.companyId), listExpiringEnvPermits(session.companyId, 30), listEmissions(session.companyId),
    listWaste(session.companyId), getEnvironmentalSummary(session.companyId, fromDate, toDate)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Çevre (Emisyon/Atık/İzin)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>İSG olay kayıtları için <a href="/dashboard/safety">ayrı sayfa</a>.</p>

      {expiringPermits.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8, color: '#b00' }}>30 Gün İçinde Sona Erecek İzinler ({expiringPermits.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Son Tarih</th></tr></thead>
            <tbody>
              {expiringPermits.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.permitNo}</td>
                  <td style={{ padding: '6px 8px' }}>{PERMIT_TYPE_LABELS[p.permitType]}</td>
                  <td style={{ padding: '6px 8px', color: '#b00', fontWeight: 600 }}>{p.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Çevre İzni Ekle</h2>
      <div style={{ marginBottom: 24 }}><CreateEnvPermitForm /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>İzinler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Veren Kurum</th><th style={{ padding: '6px 8px' }}>Son Tarih</th><th style={{ padding: '6px 8px' }}>Durum</th></tr></thead>
        <tbody>
          {permits.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.permitNo}</td>
              <td style={{ padding: '6px 8px' }}>{PERMIT_TYPE_LABELS[p.permitType]}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.issuingAuthority || '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.expiryDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{PERMIT_STATUS_LABELS[p.status]}</td>
            </tr>
          ))}
          {permits.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz izin yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Emisyon Kaydet</h2>
      <div style={{ marginBottom: 20 }}><RecordEmissionForm /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Atık Kaydet</h2>
      <div style={{ marginBottom: 24 }}><RecordWasteForm /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Dönem Özeti ({fromDate} — {toDate})</h2>
      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>Emisyon (Tipe Göre)</h3>
          {Object.keys(summary.emissionByType).length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Kayıt yok.</p> : (
            <ul style={{ fontSize: 13, listStyle: 'none', padding: 0 }}>
              {Object.entries(summary.emissionByType).map(([type, qty]) => <li key={type}>{EMISSION_TYPE_LABELS[type] ?? type}: <strong>{qty}</strong></li>)}
            </ul>
          )}
        </div>
        <div>
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>Atık (Tipe Göre)</h3>
          {Object.keys(summary.wasteByType).length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Kayıt yok.</p> : (
            <ul style={{ fontSize: 13, listStyle: 'none', padding: 0 }}>
              {Object.entries(summary.wasteByType).map(([type, qty]) => <li key={type}>{WASTE_TYPE_LABELS[type] ?? type}: <strong>{qty}</strong></li>)}
            </ul>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Emisyon Kayıtları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th><th style={{ padding: '6px 8px' }}>Kaynak</th></tr></thead>
        <tbody>
          {emissions.slice(0, 20).map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', color: '#666' }}>{e.recordDate}</td>
              <td style={{ padding: '6px 8px' }}>{EMISSION_TYPE_LABELS[e.emissionType]}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{e.quantity} {e.unit}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{e.source || '—'}</td>
            </tr>
          ))}
          {emissions.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz kayıt yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Atık Kayıtları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th><th style={{ padding: '6px 8px' }}>Bertaraf</th></tr></thead>
        <tbody>
          {wastes.slice(0, 20).map((w) => (
            <tr key={w.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', color: '#666' }}>{w.recordDate}</td>
              <td style={{ padding: '6px 8px' }}>{WASTE_TYPE_LABELS[w.wasteType]}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{w.quantity} {w.unit}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{w.disposalCompany || '—'}</td>
            </tr>
          ))}
          {wastes.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz kayıt yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
