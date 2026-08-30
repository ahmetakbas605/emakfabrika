import { requireSession } from '@/lib/dal';
import { getMrpRun } from '@/lib/mrp/engine';
import { ConvertToProductionButton, ConvertToPurchaseButton, CancelPlannedOrderButton } from '@/components/mrp/mrp-forms';

const ORDER_TYPE_LABELS: Record<string, string> = { PRODUCTION: 'Üretim', PURCHASE: 'Satın Alma' };
const STATUS_LABELS: Record<string, string> = { SUGGESTED: 'Önerildi', CONVERTED: 'Dönüştürüldü', CANCELLED: 'İptal' };
const SOURCE_LABELS: Record<string, string> = { SALES_ORDER: 'Satış Siparişi', MIN_STOCK: 'Minimum Stok', BOM_EXPLOSION: 'BOM Patlatması' };

export default async function MrpRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const session = await requireSession();
  const { run, plannedOrders } = await getMrpRun(session.companyId, runId);
  const productNameById = new Map(plannedOrders.map((p) => [p.id, p.productName]));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>MRP Koşusu — {run.runDate}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{plannedOrders.length} önerilen kalem. Bir öneriyi dönüştürmek, ilgili modülde (Üretim/Satınalma) GERÇEK bir taslak belge açar.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Ürün</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Kaynak</th><th style={{ padding: '6px 8px' }}>Üst Öneri</th>
            <th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {plannedOrders.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{p.productSku} — {p.productName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.quantity}</td>
              <td style={{ padding: '6px 8px' }}>{ORDER_TYPE_LABELS[p.orderType] ?? p.orderType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{SOURCE_LABELS[p.demandSource] ?? p.demandSource}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{p.parentId ? (productNameById.get(p.parentId) ?? '—') : '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[p.status] ?? p.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {p.status === 'SUGGESTED' ? (
                  <>
                    {p.orderType === 'PRODUCTION' ? <ConvertToProductionButton plannedOrderId={p.id} /> : <ConvertToPurchaseButton plannedOrderId={p.id} />}
                    <CancelPlannedOrderButton plannedOrderId={p.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {plannedOrders.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Net ihtiyaç bulunamadı — mevcut stok/açık siparişler talebi karşılıyor.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
