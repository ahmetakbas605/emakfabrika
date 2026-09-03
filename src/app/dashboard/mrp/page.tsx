import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listMrpRuns } from '@/lib/mrp/engine';
import { listWarehouses, listStockItemsWithProduct } from '@/lib/warehouse';
import { RunMrpForm, SetMinQtyForm } from '@/components/mrp/mrp-forms';

const RUN_STATUS_LABELS: Record<string, string> = { RUNNING: 'Çalışıyor', COMPLETED: 'Tamamlandı', FAILED: 'Başarısız' };

export default async function MrpPage() {
  const session = await requireSession();
  const [runs, warehouses, stockItems] = await Promise.all([listMrpRuns(session.companyId), listWarehouses(session.companyId), listStockItemsWithProduct(session.companyId)]);
  const warehouseNameById = new Map(warehouses.map((w) => [w.id, w.name]));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>MRP (Malzeme İhtiyaç Planlaması)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Satış siparişleri + Minimum stok + Mevcut stok + Açık satın alma + Açık üretim üzerinden net ihtiyaç hesaplar; BOM'u çok seviyeli patlatır. Hiçbir belgeyi OTOMATİK açmaz — her öneri elle dönüştürülür veya iptal edilir.</p>

      <div style={{ marginBottom: 24 }}><RunMrpForm warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))} /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Minimum Stok Ayarları</h2>
      <p style={{ color: 'var(--dim-slate)', marginBottom: 8, fontSize: 12 }}>Yalnızca Master Data ürünlerine bağlı stok kartları listelenir — MRP yalnızca bunları planlayabilir.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>SKU</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Minimum Stok</th>
          </tr>
        </thead>
        <tbody>
          {stockItems.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.sku}</td>
              <td style={{ padding: '6px 8px' }}>{s.name}</td>
              <td style={{ padding: '6px 8px' }}><SetMinQtyForm stockItemId={s.id} currentMinQty={s.minQty} /></td>
            </tr>
          ))}
          {stockItems.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Master Data'ya bağlı stok kartı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Geçmiş MRP Koşuları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Depo</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{r.runDate}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{warehouseNameById.get(r.warehouseId) ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{RUN_STATUS_LABELS[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/mrp/${r.id}`}>Önerileri Gör →</Link></td>
            </tr>
          ))}
          {runs.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz MRP koşusu yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
