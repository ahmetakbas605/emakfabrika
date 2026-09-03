import { requireDepartmentAccess } from '@/lib/dal';
import { listWarehouses, listStockItems, listStockTransfers, TRANSFER_TRANSITIONS } from '@/lib/warehouse';
import { StockTransferForm } from '@/components/stock-transfer-form';
import { StockTransferTransitionForm } from '@/components/stock-transfer-transition-form';

const TRANSFER_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', REQUESTED: 'Talep Edildi', APPROVED: 'Onaylandı', IN_TRANSIT: 'Yolda', RECEIVED: 'Teslim Alındı', CANCELLED: 'İptal' };

export default async function StockTransfersPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [warehouses, stockItems, transfers] = await Promise.all([
    listWarehouses(session.companyId),
    listStockItems(session.companyId),
    listStockTransfers(session.companyId)
  ]);
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Depo Transferleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Talep → Onay → Yolda → Teslim Alındı (madde 55) — Teslim Alındı'ya geçişte gerçek stok hareketleri (kaynaktan çıkış, hedefe giriş) TEK işlemde oluşturulur.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th>
            <th style={{ padding: '6px 8px' }}>Kaynak</th>
            <th style={{ padding: '6px 8px' }}>Hedef</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{t.transferNo}</td>
              <td style={{ padding: '6px 8px' }}>{warehouseById.get(t.sourceWarehouseId)?.name ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>{warehouseById.get(t.destinationWarehouseId)?.name ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{TRANSFER_STATUS_LABEL[t.status] ?? t.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {access.permissions.update ? <StockTransferTransitionForm departmentId={departmentId} transferId={t.id} nextStatuses={TRANSFER_TRANSITIONS[t.status] ?? []} /> : null}
              </td>
            </tr>
          ))}
          {transfers.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz transfer yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? (
        <StockTransferForm departmentId={departmentId} warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name }))} />
      ) : null}
    </div>
  );
}
