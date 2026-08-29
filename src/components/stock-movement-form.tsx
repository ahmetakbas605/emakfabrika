'use client';

import { useActionState, useState } from 'react';
import { recordStockMovementAction, type FormState } from '@/actions/warehouse';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StockMovementForm({
  departmentId,
  warehouses,
  stockItems,
  accounts
}: {
  departmentId: string;
  warehouses: { id: string; name: string }[];
  stockItems: { id: string; sku: string; name: string; accountingAccountId: string | null }[];
  accounts: { code: string; name: string }[];
}) {
  const action = recordStockMovementAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [stockItemId, setStockItemId] = useState('');
  const selectedItem = stockItems.find((s) => s.id === stockItemId);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Depo</label>
        <select name="warehouseId" required style={{ padding: 6 }}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Stok Kartı</label>
        <select name="stockItemId" required value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} style={{ padding: 6, minWidth: 180 }}>
          <option value="">Seçin...</option>
          {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Yön</label>
        <select name="movementType" value={movementType} onChange={(e) => setMovementType(e.target.value as 'IN' | 'OUT')} style={{ padding: 6 }}>
          <option value="IN">Giriş</option>
          <option value="OUT">Çıkış</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Miktar</label>
        <input name="quantity" type="number" step="any" min={0.01} required style={{ padding: 6, width: 100 }} />
      </div>
      {movementType === 'IN' ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim Maliyet</label>
          <input name="unitCost" type="number" step="any" min={0.01} required style={{ padding: 6, width: 110 }} />
        </div>
      ) : null}
      {selectedItem?.accountingAccountId ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Karşı Hesap (muhasebeleştirmek için)</label>
          <select name="counterAccountCode" style={{ padding: 6, minWidth: 180 }}>
            <option value="">Muhasebeleştirme yok</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
        </div>
      ) : null}
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label>
        <input name="transactionDate" type="date" defaultValue={todayIso()} required style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Kaydediliyor...' : 'Hareketi Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
