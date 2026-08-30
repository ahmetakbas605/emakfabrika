'use client';

import { useActionState, useState } from 'react';
import { createShipmentAction, dispatchShipmentAction, markShipmentDeliveredAction, cancelShipmentAction, type FormState } from '@/actions/sales-shipments';

interface OrderLineForShipment { id: string; productName: string; remaining: string }

export function CreateShipmentForm({ orderId, warehouses, lines }: { orderId: string; warehouses: { id: string; name: string }[]; lines: OrderLineForShipment[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createShipmentAction, undefined);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const linesJson = JSON.stringify(
    Object.entries(quantities)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([orderLineId, qty]) => ({ orderLineId, quantity: Number(qty) }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="linesJson" value={linesJson} />
      <h4 style={{ fontSize: 13, margin: 0 }}>Yeni Sevkiyat Hazırla</h4>
      <div style={{ display: 'flex', gap: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Depo</label>
          <select name="warehouseId" required style={{ padding: 5, minWidth: 140 }}>
            <option value="">Seçin</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Sevkiyat Tarihi</label><input name="shipmentDate" type="date" required style={{ padding: 5 }} /></div>
      </div>
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left', padding: '2px 6px' }}>Ürün</th><th style={{ padding: '2px 6px' }}>Kalan</th><th style={{ padding: '2px 6px' }}>Sevk Miktarı</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td style={{ padding: '2px 6px' }}>{l.productName}</td>
              <td style={{ padding: '2px 6px', textAlign: 'right' }}>{l.remaining}</td>
              <td style={{ padding: '2px 6px' }}><input value={quantities[l.id] ?? ''} onChange={(e) => setQuantities((prev) => ({ ...prev, [l.id]: e.target.value }))} style={{ padding: 4, width: 70 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>{pending ? '...' : 'Sevkiyat Hazırla'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 11, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function DispatchShipmentButton({ shipmentId }: { shipmentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(dispatchShipmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Sevk Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function MarkShipmentDeliveredButton({ shipmentId }: { shipmentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markShipmentDeliveredAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Teslim Edildi'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelShipmentButton({ shipmentId }: { shipmentId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelShipmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
