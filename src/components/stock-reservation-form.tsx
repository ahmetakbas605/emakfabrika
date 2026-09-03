'use client';

import { useActionState } from 'react';
import { reserveStockAction, releaseReservationAction, type FormState } from '@/actions/warehouse';

export function StockReservationForm({ departmentId, warehouses, stockItems }: { departmentId: string; warehouses: { id: string; name: string }[]; stockItems: { id: string; sku: string; name: string }[] }) {
  const action = reserveStockAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Depo</label>
        <select name="warehouseId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Stok Kartı</label>
        <select name="stockItemId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Miktar</label>
        <input name="quantity" required style={{ padding: 6, width: 100 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Rezervasyon Oluştur'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}

export function ReleaseReservationButton({ departmentId, reservationId }: { departmentId: string; reservationId: string }) {
  const action = releaseReservationAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline' }}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>{pending ? '...' : 'Serbest Bırak'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
