'use client';

import { useActionState, useState } from 'react';
import { createInvoiceAction, approveInvoiceAction, cancelInvoiceAction, type FormState } from '@/actions/sales-invoices';

interface OrderLineForInvoice { id: string; productId: string; productName: string; unitPrice: string; taxRatePercent: string; remaining: string }

export function CreateInvoiceFromOrderForm({ orderId, partyId, currencyCode, lines }: { orderId: string; partyId: string; currencyCode: string; lines: OrderLineForInvoice[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createInvoiceAction, undefined);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const linesJson = JSON.stringify(
    lines
      .filter((l) => quantities[l.id] && Number(quantities[l.id]) > 0)
      .map((l) => ({ orderLineId: l.id, productId: l.productId, quantity: Number(quantities[l.id]), unitPrice: Number(l.unitPrice), taxRatePercent: Number(l.taxRatePercent) }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="currencyCode" value={currencyCode} />
      <input type="hidden" name="linesJson" value={linesJson} />
      <h4 style={{ fontSize: 13, margin: 0 }}>Yeni Fatura Hazırla</h4>
      <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Fatura Tarihi</label><input name="invoiceDate" type="date" required style={{ padding: 5 }} /></div>
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left', padding: '2px 6px' }}>Ürün</th><th style={{ padding: '2px 6px' }}>Kalan</th><th style={{ padding: '2px 6px' }}>Fatura Miktarı</th></tr></thead>
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
        <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>{pending ? '...' : 'Fatura Oluştur (Taslak)'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 11, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function ApproveInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(approveInvoiceAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input name="revenueAccountCode" placeholder="Gelir hesabı (ops.)" style={{ padding: '2px 4px', fontSize: 11, width: 110 }} />
      <input name="receivableAccountCode" placeholder="Alıcılar hesabı (ops.)" style={{ padding: '2px 4px', fontSize: 11, width: 120 }} />
      <input name="taxAccountCode" placeholder="KDV hesabı (ops.)" style={{ padding: '2px 4px', fontSize: 11, width: 100 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Onayla'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelInvoiceAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
