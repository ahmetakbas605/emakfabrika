import { requireDepartmentAccess } from '@/lib/dal';
import { listWarehouses, listWhLocations, listInvBalances } from '@/lib/warehouse';
import { WhLocationForm } from '@/components/wh-location-form';

const LOCATION_TYPE_LABEL: Record<string, string> = { ZONE: 'Bölge', AISLE: 'Koridor', RACK: 'Raf', SHELF: 'Göz', BIN: 'Bin' };

export default async function WarehouseDetailPage({ params }: { params: Promise<{ departmentId: string; warehouseId: string }> }) {
  const { departmentId, warehouseId } = await params;
  const { session } = await requireDepartmentAccess(departmentId);
  const [warehouses, locations, balances] = await Promise.all([
    listWarehouses(session.companyId),
    listWhLocations(warehouseId),
    listInvBalances(session.companyId, warehouseId)
  ]);
  const warehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{warehouse?.name ?? 'Depo'}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Konum hiyerarşisi (Bölge/Koridor/Raf/Göz/Bin) ve depo bazlı bakiye.</p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Bakiye (bu depo)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>SKU</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Ort. Maliyet</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{b.sku}</td>
              <td style={{ padding: '6px 8px' }}>{b.name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(b.qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{Number(b.avgCost).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
            </tr>
          ))}
          {balances.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Bu depoda henüz hareket yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Konumlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{l.code}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{LOCATION_TYPE_LABEL[l.locationType] ?? l.locationType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{l.name || '—'}</td>
            </tr>
          ))}
          {locations.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: '#999' }}>Henüz konum yok.</td></tr> : null}
        </tbody>
      </table>

      <WhLocationForm departmentId={departmentId} warehouseId={warehouseId} locations={locations.map((l) => ({ id: l.id, code: l.code }))} />
    </div>
  );
}
