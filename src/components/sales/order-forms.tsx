'use client';

import { useActionState, useState } from 'react';
import { createOrderAction, submitOrderAction, cancelOrderAction, type FormState } from '@/actions/sales-orders';

interface Line { productId: string; quantity: string; unitPrice: string; discountPercent: string; taxRatePercent: string }
const EMPTY_LINE: Line = { productId: '', quantity: '', unitPrice: '', discountPercent: '', taxRatePercent: '' };

export function CreateOrderForm({ parties, products }: { parties: { id: string; legalName: string }[]; products: { id: string; sku: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createOrderAction, undefined);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const linesJson = JSON.stringify(
    lines
      .filter((l) => l.productId && l.quantity && l.unitPrice)
      .map((l) => ({
        productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice),
        discountPercent: l.discountPercent ? Number(l.discountPercent) : undefined, taxRatePercent: l.taxRatePercent ? Number(l.taxRatePercent) : undefined
      }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="linesJson" value={linesJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni Sipariş (doğrudan)</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Cari</label>
          <select name="partyId" required style={{ padding: 6, minWidth: 160 }}>
            <option value="">Seçin</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sipariş Tarihi</label><input name="orderDate" type="date" required style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label><input name="currencyCode" defaultValue="TRY" required style={{ padding: 6, width: 70 }} /></div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Kalemler</label>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
            <div style={{ minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Ürün</label>
              <select value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} style={{ padding: 5, width: '100%' }}>
                <option value="">Seçin</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Miktar</label><input value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ padding: 5, width: 70 }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Birim Fiyat</label><input value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} style={{ padding: 5, width: 90 }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>İskonto %</label><input value={line.discountPercent} onChange={(e) => updateLine(i, { discountPercent: e.target.value })} style={{ padding: 5, width: 70 }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>KDV %</label><input value={line.taxRatePercent} onChange={(e) => updateLine(i, { taxRatePercent: e.target.value })} placeholder="ürün varsayılanı" style={{ padding: 5, width: 90 }} /></div>
            {lines.length > 1 ? <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
          </div>
        ))}
        <button type="button" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])} style={{ cursor: 'pointer', fontSize: 13 }}>+ Kalem Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Sipariş Oluştur (Taslak)'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function SubmitOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Onaya Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
