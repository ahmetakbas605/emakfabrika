import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listProcRequests } from '@/lib/procurement/requisition';
import { listUnits } from '@/lib/master-data/units';
import { listProducts } from '@/lib/master-data/products';
import { listStockItems, listWarehouses } from '@/lib/warehouse';
import { listCostCenters } from '@/lib/cost-centers';
import { listBudgetItems } from '@/lib/budgets';
import { ProcRequestForm } from '@/components/procurement/proc-request-form';

const REQUEST_TYPE_LABEL: Record<string, string> = {
  NORMAL: 'Normal', URGENT: 'Acil', EMERGENCY: 'Çok Acil', PROJECT: 'Proje', PRODUCTION: 'Üretim', MAINTENANCE: 'Bakım',
  IT: 'BT', OFFICE: 'Ofis', RAW_MATERIAL: 'Hammadde', SERVICE: 'Hizmet', CAPEX: 'CAPEX', OPEX: 'OPEX', STOCK_REPLENISHMENT: 'Stok Tamamlama'
};
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

export default async function ProcurementPage() {
  const session = await requireSession();
  const [requests, units, products, stockItems, warehouses, costCenters, budgetItems] = await Promise.all([
    listProcRequests(session.companyId),
    listUnits(session.companyId),
    listProducts(session.companyId),
    listStockItems(session.companyId),
    listWarehouses(session.companyId),
    listCostCenters(session.companyId),
    listBudgetItems(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Satınalma Talepleri</h1>
        <Link href="/dashboard/procurement/rfqs" style={{ fontSize: 13 }}>RFQ'lar (Teklif Talepleri) →</Link>
      </div>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Talep → Stok/Bütçe Kontrolü → Onay (madde 12-28). Onay motoru genel — bkz. Onay Kutusu.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th>
            <th style={{ padding: '6px 8px' }}>Talep Eden</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Öncelik</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tahmini Tutar</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/procurement/${r.id}`}>{r.requestNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{r.requestedByName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.priority}</td>
              <td style={{ padding: '6px 8px' }}>{STATUS_LABEL[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.estimatedTotal ? `${Number(r.estimatedTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${r.currencyCode ?? ''}` : '—'}</td>
            </tr>
          ))}
          {requests.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz talep yok.</td></tr> : null}
        </tbody>
      </table>

      {units.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>Önce Master Data → Birimler sayfasında en az bir birim tanımlanmalı.</p>
      ) : (
        <ProcRequestForm
          units={units.map((u) => ({ id: u.id, code: u.code }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
          stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name }))}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          costCenters={costCenters.map((c) => ({ id: c.id, name: c.name }))}
          budgetItems={budgetItems.map((b) => ({ id: b.id, budgetName: b.budgetName, accountName: b.accountName }))}
        />
      )}
    </div>
  );
}
