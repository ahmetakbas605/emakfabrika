import { requireSession } from '@/lib/dal';
import { listRoutings } from '@/lib/production/routing';
import { listWorkCenters } from '@/lib/production/workcenters';
import { listProducts } from '@/lib/master-data/products';
import { CreateRoutingForm } from '@/components/production/routing-forms';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Güncel', SUPERSEDED: 'Eski Versiyon' };

export default async function RoutingPage() {
  const session = await requireSession();
  const [routings, workCenters, products] = await Promise.all([listRoutings(session.companyId), listWorkCenters(session.companyId), listProducts(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Routing (Rota)</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Opsiyonel — routing tanımlı bir ürünün üretim emri, serbest bırakıldığında her operasyon için otomatik bir iş emri üretir.</p>

      {workCenters.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13, marginBottom: 20 }}>Önce en az bir İş Merkezi tanımlanmalı.</p>
      ) : (
        <div style={{ marginBottom: 20 }}><CreateRoutingForm products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} workCenters={workCenters.map((w) => ({ id: w.id, code: w.code, name: w.name }))} /></div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>Ürün</th>
            <th style={{ padding: '6px 8px' }}>Versiyon</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {routings.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.code}</td>
              <td style={{ padding: '6px 8px' }}>{r.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.productName}</td>
              <td style={{ padding: '6px 8px' }}>v{r.version}</td>
              <td style={{ padding: '6px 8px', fontWeight: r.status === 'ACTIVE' ? 600 : 400, color: r.status === 'ACTIVE' ? undefined : 'var(--dim-slate)' }}>{STATUS_LABELS[r.status] ?? r.status}</td>
            </tr>
          ))}
          {routings.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz routing yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
