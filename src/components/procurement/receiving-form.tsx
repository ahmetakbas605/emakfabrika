'use client';

import { useActionState, useState } from 'react';
import { createGoodsReceiptAction, createVendorInvoiceAction, approveVendorInvoiceAction, cancelVendorInvoiceAction, type FormState } from '@/actions/procurement-receiving';

export interface ReceivablePoLine { poLineId: string; description: string; unitCode: string; remainingQty: string }
interface ReceiptRow { receivedQty: string; warehouseId: string; stockItemId: string; counterAccountCode: string }

export function GoodsReceiptForm({ poId, lines, warehouses, stockItems }: { poId: string; lines: ReceivablePoLine[]; warehouses: { id: string; name: string }[]; stockItems: { id: string; sku: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createGoodsReceiptAction, undefined);
  const [rows, setRows] = useState<Record<string, ReceiptRow>>(() => Object.fromEntries(lines.map((l) => [l.poLineId, { receivedQty: '', warehouseId: '', stockItemId: '', counterAccountCode: '' }])));

  function update(poLineId: string, patch: Partial<ReceiptRow>) {
    setRows((prev) => ({ ...prev, [poLineId]: { ...prev[poLineId], ...patch } }));
  }

  const flatLines = lines
    .map((l) => ({ poLineId: l.poLineId, ...rows[l.poLineId] }))
    .filter((r) => r.receivedQty)
    .map((r) => ({ poLineId: r.poLineId, receivedQty: r.receivedQty, warehouseId: r.warehouseId || undefined, stockItemId: r.stockItemId || undefined, counterAccountCode: r.counterAccountCode || undefined }));

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 14 }}>
      <input type="hidden" name="poId" value={poId} />
      <input type="hidden" name="linesJson" value={JSON.stringify(flatLines)} />
      <h4 style={{ fontSize: 13, margin: 0 }}>Mal Kabul</h4>
      <input name="receiptDate" type="date" required style={{ padding: 6, width: 160 }} />

      {lines.map((l) => (
        <div key={l.poLineId} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ minWidth: 160 }}>{l.description} (kalan: {Number(l.remainingQty).toLocaleString('tr-TR')} {l.unitCode})</span>
          <input value={rows[l.poLineId]?.receivedQty ?? ''} onChange={(e) => update(l.poLineId, { receivedQty: e.target.value })} placeholder="Kabul edilen" style={{ padding: 5, width: 90 }} />
          <select value={rows[l.poLineId]?.warehouseId ?? ''} onChange={(e) => update(l.poLineId, { warehouseId: e.target.value })} style={{ padding: 5 }}>
            <option value="">Depo (opsiyonel)</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={rows[l.poLineId]?.stockItemId ?? ''} onChange={(e) => update(l.poLineId, { stockItemId: e.target.value })} style={{ padding: 5 }}>
            <option value="">Stok kartı (opsiyonel)</option>
            {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name}</option>)}
          </select>
          {rows[l.poLineId]?.warehouseId && rows[l.poLineId]?.stockItemId ? (
            <input value={rows[l.poLineId]?.counterAccountCode ?? ''} onChange={(e) => update(l.poLineId, { counterAccountCode: e.target.value })} placeholder="Karşı hesap kodu (opsiyonel)" style={{ padding: 5, width: 160 }} />
          ) : null}
        </div>
      ))}

      <div>
        <button type="submit" disabled={pending || flatLines.length === 0} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Mal Kabulü Kaydet'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

interface InvoiceRow { invoicedQty: string; invoicedUnitPrice: string }

export function VendorInvoiceForm({ poId, currencyCode, lines }: { poId: string; currencyCode: string; lines: { poLineId: string; description: string; unitCode: string; unitPrice: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createVendorInvoiceAction, undefined);
  const [rows, setRows] = useState<Record<string, InvoiceRow>>(() => Object.fromEntries(lines.map((l) => [l.poLineId, { invoicedQty: '', invoicedUnitPrice: l.unitPrice }])));

  function update(poLineId: string, patch: Partial<InvoiceRow>) {
    setRows((prev) => ({ ...prev, [poLineId]: { ...prev[poLineId], ...patch } }));
  }

  const flatLines = lines
    .map((l) => ({ poLineId: l.poLineId, ...rows[l.poLineId] }))
    .filter((r) => r.invoicedQty)
    .map((r) => ({ poLineId: r.poLineId, invoicedQty: r.invoicedQty, invoicedUnitPrice: r.invoicedUnitPrice }));

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 14 }}>
      <input type="hidden" name="poId" value={poId} />
      <input type="hidden" name="currencyCode" value={currencyCode} />
      <input type="hidden" name="linesJson" value={JSON.stringify(flatLines)} />
      <h4 style={{ fontSize: 13, margin: 0 }}>Tedarikçi Faturası</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input name="supplierInvoiceNo" placeholder="Tedarikçi fatura no" required style={{ padding: 6, width: 160 }} />
        <input name="invoiceDate" type="date" required style={{ padding: 6, width: 160 }} />
      </div>

      {lines.map((l) => (
        <div key={l.poLineId} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ minWidth: 160 }}>{l.description} (PO fiyatı: {Number(l.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})</span>
          <input value={rows[l.poLineId]?.invoicedQty ?? ''} onChange={(e) => update(l.poLineId, { invoicedQty: e.target.value })} placeholder="Faturalanan miktar" style={{ padding: 5, width: 110 }} />
          <input value={rows[l.poLineId]?.invoicedUnitPrice ?? ''} onChange={(e) => update(l.poLineId, { invoicedUnitPrice: e.target.value })} placeholder="Birim fiyat" style={{ padding: 5, width: 90 }} />
        </div>
      ))}

      <div>
        <button type="submit" disabled={pending || flatLines.length === 0} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Faturayı Kaydet'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function ApproveInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(approveVendorInvoiceAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input name="clearingAccountCode" placeholder="GR/IR clearing hesap kodu (opsiyonel)" style={{ padding: 5, fontSize: 12, width: 220 }} />
      <input name="payableAccountCode" placeholder="Satıcılar hesap kodu (opsiyonel)" style={{ padding: 5, fontSize: 12, width: 200 }} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Onayla'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12 }}>{state.success}</span> : null}
    </form>
  );
}

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelVendorInvoiceAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
