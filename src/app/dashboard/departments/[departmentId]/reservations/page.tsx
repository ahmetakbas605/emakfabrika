import { requireDepartmentAccess } from '@/lib/dal';
import { listWarehouses, listStockItems, listReservations } from '@/lib/warehouse';
import { StockReservationForm, ReleaseReservationButton } from '@/components/stock-reservation-form';

const RESERVATION_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Aktif', RELEASED: 'Serbest Bırakıldı', CONSUMED: 'Tüketildi' };

export default async function ReservationsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [warehouses, stockItems, reservations] = await Promise.all([
    listWarehouses(session.companyId),
    listStockItems(session.companyId),
    listReservations(session.companyId)
  ]);
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const itemById = new Map(stockItems.map((s) => [s.id, s]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Stok Rezervasyonları</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        AVAILABLE = ON_HAND − RESERVED (madde 57-59). Satış siparişi henüz yok — bu, ileride Faz 2C&apos;nin (Satış) kullanacağı altyapının şimdiden hazır, elle test edilebilir hâli.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Depo</th>
            <th style={{ padding: '6px 8px' }}>Stok Kartı</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{warehouseById.get(r.warehouseId)?.name ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{itemById.get(r.stockItemId)?.sku ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(r.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{RESERVATION_STATUS_LABEL[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {r.status === 'ACTIVE' && access.permissions.update ? <ReleaseReservationButton departmentId={departmentId} reservationId={r.id} /> : null}
              </td>
            </tr>
          ))}
          {reservations.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz rezervasyon yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? (
        <StockReservationForm departmentId={departmentId} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name }))} />
      ) : null}
    </div>
  );
}
