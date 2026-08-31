import { requireSession } from '@/lib/dal';
import { listVehicles } from '@/lib/fleet/vehicles';
import { listVehicleExpenses, getVehicleFuelEfficiency } from '@/lib/fleet/expenses';
import { RecordVehicleExpenseForm } from '@/components/fleet/fleet-forms';

const EXPENSE_TYPE_LABELS: Record<string, string> = { FUEL: 'Yakıt', HGS: 'HGS', TOLL: 'Köprü/Otoyol', WASH: 'Yıkama', PARKING: 'Otopark', OTHER: 'Diğer' };

export default async function FleetExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; vehicleId?: string }> }) {
  const { from, to, vehicleId } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || ninetyDaysAgo;
  const toDate = to || today;

  const [vehicles, expenses] = await Promise.all([listVehicles(session.companyId), listVehicleExpenses(session.companyId)]);
  const selectedVehicleId = vehicleId || vehicles[0]?.id;
  const efficiency = selectedVehicleId ? await getVehicleFuelEfficiency(session.companyId, selectedVehicleId, fromDate, toDate) : null;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Araç Giderleri (Yakıt/HGS/Toll)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Yakıt verimliliği, kilometre okumaları arasındaki farktan talep üzerine hesaplanır — saklanan bir değer değil.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Gider Kaydet</h2>
      {vehicles.length === 0 ? (
        <p style={{ color: '#b00', fontSize: 13, marginBottom: 24 }}>Önce en az bir araç eklenmeli.</p>
      ) : (
        <div style={{ marginBottom: 24 }}><RecordVehicleExpenseForm vehicles={vehicles.map((v) => ({ id: v.id, plateNo: v.plateNo }))} /></div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Gider Kayıtları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Plaka</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Litre</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>KM</th>
          </tr>
        </thead>
        <tbody>
          {expenses.slice(0, 20).map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{e.plateNo}</td>
              <td style={{ padding: '6px 8px' }}>{EXPENSE_TYPE_LABELS[e.expenseType]}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{e.expenseDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{e.amount}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{e.quantity ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{e.odometerKm ?? '—'}</td>
            </tr>
          ))}
          {expenses.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz gider kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      {vehicles.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Yakıt Verimliliği</h2>
          <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Araç</label>
              <select name="vehicleId" defaultValue={selectedVehicleId} style={{ padding: 6, minWidth: 100 }}>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNo}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
            <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
          </form>

          {efficiency ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Stat label="Toplam Yakıt Tutarı" value={String(efficiency.totalFuelAmount)} />
              <Stat label="Toplam Litre" value={String(efficiency.totalFuelLiters)} />
              <Stat label="Ortalama Birim Fiyat" value={efficiency.avgCostPerLiter === null ? '—' : efficiency.avgCostPerLiter.toFixed(2)} />
              <Stat label="Toplam KM" value={efficiency.totalKm === null ? '—' : String(efficiency.totalKm)} />
              <Stat label="KM / Litre" value={efficiency.kmPerLiter === null ? '—' : efficiency.kmPerLiter.toFixed(2)} big />
            </div>
          ) : null}
        </>
      ) : null}
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
