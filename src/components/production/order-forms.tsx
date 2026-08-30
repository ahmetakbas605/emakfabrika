'use client';

import { useActionState } from 'react';
import { createProductionOrderAction, submitProductionOrderAction, cancelProductionOrderAction, type FormState } from '@/actions/production-orders';

export function CreateProductionOrderForm({ products, units, warehouses }: { products: { id: string; sku: string; name: string }[]; units: { id: string; code: string }[]; warehouses: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProductionOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ürün (ACTIVE BOM'u olmalı)</label>
        <select name="productId" required style={{ padding: 6, minWidth: 180 }}>
          <option value="">Seçin</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Miktar</label><input name="quantity" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim</label>
        <select name="unitId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Depo</label>
        <select name="warehouseId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Planlanan Başlangıç</label><input name="plannedStartDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Planlanan Bitiş</label><input name="plannedEndDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Üretim Emri Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function SubmitProductionOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitProductionOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Onaya Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelProductionOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelProductionOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
