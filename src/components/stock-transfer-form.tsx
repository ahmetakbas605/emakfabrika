'use client';

import { useActionState, useState } from 'react';
import { createStockTransferAction, type FormState } from '@/actions/warehouse';

interface Line { stockItemId: string; quantity: string }

export function StockTransferForm({
  departmentId, warehouses, stockItems
}: {
  departmentId: string;
  warehouses: { id: string; name: string }[];
  stockItems: { id: string; sku: string; name: string }[];
}) {
  const action = createStockTransferAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [lines, setLines] = useState<Line[]>([{ stockItemId: '', quantity: '' }]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { stockItemId: '', quantity: '' }]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="linesJson" value={JSON.stringify(lines.filter((l) => l.stockItemId && l.quantity))} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kaynak Depo</label>
          <select name="sourceWarehouseId" required style={{ padding: 6 }}>
            <option value="">Seçin</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hedef Depo</label>
          <select name="destinationWarehouseId" required style={{ padding: 6 }}>
            <option value="">Seçin</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Not</label>
          <input name="notes" style={{ padding: 6, width: '100%' }} />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Satırlar</label>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <select value={line.stockItemId} onChange={(e) => updateLine(i, { stockItemId: e.target.value })} style={{ padding: 6, minWidth: 200 }}>
              <option value="">Stok kartı seçin</option>
              {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name}</option>)}
            </select>
            <input value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder="Miktar" style={{ padding: 6, width: 100 }} />
            {lines.length > 1 ? <button type="button" onClick={() => removeLine(i)} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
          </div>
        ))}
        <button type="button" onClick={addLine} style={{ cursor: 'pointer', fontSize: 13 }}>+ Satır Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'Transfer Oluştur'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
