'use client';

import { useActionState } from 'react';
import { consumePartAction, type FormState } from '@/actions/it/field-service';

export function ConsumePartForm({
  departmentId, workOrderId, warehouses, stockItems
}: {
  departmentId: string; workOrderId: string;
  warehouses: { id: string; name: string }[];
  stockItems: { id: string; sku: string; name: string; currentQty: string }[];
}) {
  const action = consumePartAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Depo</label>
        <select name="warehouseId" required style={{ padding: 6 }}>
          <option value="">Seçin...</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Malzeme</label>
        <select name="stockItemId" required style={{ padding: 6, minWidth: 200 }}>
          <option value="">Seçin...</option>
          {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name} (stok: {Number(s.currentQty).toFixed(2)})</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Miktar</label>
        <input name="quantity" type="number" step="0.01" min={0.01} required style={{ padding: 6, width: 90 }} />
      </div>
      <label style={{ fontSize: 12, color: 'var(--dim-on-surface-variant)', display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" name="billable" /> Faturalanabilir
      </label>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Malzeme Tüket'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
