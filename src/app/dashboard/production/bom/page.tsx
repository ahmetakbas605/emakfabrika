import { requireSession } from '@/lib/dal';
import { listBoms } from '@/lib/production/bom';
import { listProducts } from '@/lib/master-data/products';
import { listUnits } from '@/lib/master-data/units';
import { CreateBomForm } from '@/components/production/bom-forms';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Güncel', SUPERSEDED: 'Eski Versiyon' };

export default async function BomPage() {
  const session = await requireSession();
  const [boms, products, units] = await Promise.all([listBoms(session.companyId), listProducts(session.companyId), listUnits(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>BOM (Ürün Ağacı)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Aynı kodla yeni bir BOM oluşturmak, önceki versiyonu otomatik olarak eski versiyon işaretler — üretim emirleri her zaman güncel (ACTIVE) versiyonu kullanır.</p>

      <div style={{ marginBottom: 20 }}><CreateBomForm products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} units={units.map((u) => ({ id: u.id, code: u.code }))} /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Ürün</th>
            <th style={{ padding: '6px 8px' }}>Versiyon</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {boms.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{b.code}</td>
              <td style={{ padding: '6px 8px' }}>{b.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{b.productName}</td>
              <td style={{ padding: '6px 8px' }}>v{b.version}</td>
              <td style={{ padding: '6px 8px', fontWeight: b.status === 'ACTIVE' ? 600 : 400, color: b.status === 'ACTIVE' ? undefined : '#999' }}>{STATUS_LABELS[b.status] ?? b.status}</td>
            </tr>
          ))}
          {boms.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz BOM yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
