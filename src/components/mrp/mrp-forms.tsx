'use client';

import { useActionState } from 'react';
import { runMrpAction, convertPlannedOrderToProductionAction, convertPlannedOrderToPurchaseRequestAction, cancelPlannedOrderAction, setStockItemMinQtyAction, type FormState } from '@/actions/mrp';

export function RunMrpForm({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(runMrpAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Depo</label>
        <select name="warehouseId" required style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Koşu Tarihi</label><input name="runDate" type="date" required style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Hesaplanıyor...' : 'MRP Çalıştır'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ConvertToProductionButton({ plannedOrderId }: { plannedOrderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(convertPlannedOrderToProductionAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="plannedOrderId" value={plannedOrderId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Üretim Emrine Dönüştür'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function ConvertToPurchaseButton({ plannedOrderId }: { plannedOrderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(convertPlannedOrderToPurchaseRequestAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="plannedOrderId" value={plannedOrderId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Satın Alma Talebine Dönüştür'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelPlannedOrderButton({ plannedOrderId }: { plannedOrderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelPlannedOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="plannedOrderId" value={plannedOrderId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function SetMinQtyForm({ stockItemId, currentMinQty }: { stockItemId: string; currentMinQty: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setStockItemMinQtyAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input name="minQty" type="number" step="0.01" defaultValue={currentMinQty ?? ''} placeholder="—" style={{ padding: 4, width: 80, fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
