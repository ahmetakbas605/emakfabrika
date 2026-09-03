import { requireDepartmentAccess } from '@/lib/dal';
import { listStockItems, listWarehouses, listStockMovements } from '@/lib/warehouse';
import { listAccounts } from '@/lib/accounting';
import { listProducts } from '@/lib/master-data/products';
import { StockItemForm } from '@/components/stock-item-form';
import { StockMovementForm } from '@/components/stock-movement-form';

function num(value: string): string {
  return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function StockItemsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [stockItems, warehouses, accounts, movements, products] = await Promise.all([
    listStockItems(session.companyId),
    listWarehouses(session.companyId),
    listAccounts(session.companyId),
    listStockMovements(session.companyId),
    listProducts(session.companyId)
  ]);
  const itemBySku = new Map(stockItems.map((s) => [s.id, s]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Stok Kartları</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Ağırlıklı ortalama maliyet — birim maliyet her girişte otomatik güncellenir.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>SKU</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Birim</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Ort. Maliyet</th>
            <th style={{ padding: '6px 8px' }}>Muhasebe Hesabı</th>
          </tr>
        </thead>
        <tbody>
          {stockItems.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.sku}</td>
              <td style={{ padding: '6px 8px' }}>{s.name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(s.currentQty)}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.unit}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(s.avgCost)} ₺</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{s.accountCode ?? '—'}</td>
            </tr>
          ))}
          {stockItems.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz stok kartı yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? (
        <div style={{ marginBottom: 20 }}>
          <StockItemForm departmentId={departmentId} accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))} />
        </div>
      ) : null}

      {warehouses.length > 0 && stockItems.length > 0 && access.permissions.post ? (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Yeni Hareket</h2>
          <StockMovementForm
            departmentId={departmentId}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
            stockItems={stockItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, accountingAccountId: s.accountingAccountId }))}
            accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
          />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Son Hareketler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Stok Kartı</th>
            <th style={{ padding: '6px 8px' }}>Yön</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Birim Maliyet</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{m.transactionDate}</td>
              <td style={{ padding: '6px 8px' }}>{itemBySku.get(m.stockItemId)?.sku ?? '-'}</td>
              <td style={{ padding: '6px 8px', color: m.movementType === 'IN' ? '#080' : 'var(--dim-danger)' }}>{m.movementType === 'IN' ? 'Giriş' : 'Çıkış'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(m.quantity)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.unitCost ? num(m.unitCost) + ' ₺' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
