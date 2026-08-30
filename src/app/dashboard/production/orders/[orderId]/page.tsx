import { requireSession } from '@/lib/dal';
import { getProductionOrder } from '@/lib/production/orders';
import { getProduct } from '@/lib/master-data/products';
import { SubmitProductionOrderButton, CancelProductionOrderButton } from '@/components/production/order-forms';
import { IssueMaterialsForm, StartOperationButton, CompleteOperationForm, CompleteProductionOrderForm } from '@/components/production/execution-forms';

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak', SUBMITTED: 'Onayda', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli',
  RELEASED: 'Serbest Bırakıldı', IN_PROGRESS: 'Devam Ediyor', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal'
};
const OP_STATUS_LABELS: Record<string, string> = { PENDING: 'Bekliyor', IN_PROGRESS: 'Devam Ediyor', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal' };

export default async function ProductionOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await requireSession();
  const { order, bom, routing, operations } = await getProductionOrder(session.companyId, orderId);
  const { product } = await getProduct(session.companyId, order.productId);

  const allOperationsDone = operations.length === 0 || operations.every((op) => op.status === 'COMPLETED');
  const canIssueMaterials = (order.status === 'RELEASED' || order.status === 'IN_PROGRESS') && !order.materialsIssuedAt;
  const canComplete = order.status === 'IN_PROGRESS' && !!order.materialsIssuedAt && allOperationsDone;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{order.orderNo}</h1>
        <span style={{ fontWeight: 600 }}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{product.name} ({product.sku}) · Miktar: {order.quantity} · BOM: {bom?.code} v{bom?.version}{routing ? ` · Routing: ${routing.code} v${routing.version}` : ' · Routing yok'}</p>

      {order.status === 'DRAFT' || order.status === 'REVISION_REQUIRED' ? (
        <div style={{ marginBottom: 20 }}>
          <SubmitProductionOrderButton orderId={order.id} />
          <CancelProductionOrderButton orderId={order.id} />
        </div>
      ) : null}

      {operations.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>İş Emri Operasyonları</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                <th style={{ padding: '6px 8px' }}>#</th><th style={{ padding: '6px 8px' }}>Operasyon</th><th style={{ padding: '6px 8px' }}>Durum</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>İyi</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Fire</th><th style={{ padding: '6px 8px' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr key={op.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{op.operationOrder}</td>
                  <td style={{ padding: '6px 8px' }}>{op.name}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{OP_STATUS_LABELS[op.status] ?? op.status}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{op.goodQuantity}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{op.scrapQuantity}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {op.status === 'PENDING' ? <StartOperationButton operationId={op.id} /> : null}
                    {op.status === 'IN_PROGRESS' ? <CompleteOperationForm operationId={op.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {canIssueMaterials ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Malzeme Çıkışı</h2>
          <IssueMaterialsForm orderId={order.id} />
        </div>
      ) : null}
      {order.materialsIssuedAt ? <p style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>Malzeme çıkışı yapıldı: {new Date(order.materialsIssuedAt).toLocaleString('tr-TR')}</p> : null}

      {canComplete ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Üretimi Tamamla</h2>
          <CompleteProductionOrderForm orderId={order.id} />
        </div>
      ) : null}

      {order.status === 'COMPLETED' ? (
        <p style={{ fontSize: 13, color: '#080' }}>Tamamlandı — İyi: {order.goodQuantity}, Fire: {order.scrapQuantity} ({order.completedAt ? new Date(order.completedAt).toLocaleString('tr-TR') : ''})</p>
      ) : null}
    </div>
  );
}
