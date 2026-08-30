'use client';

import { useActionState, useState } from 'react';
import { createQuoteAction, setQuoteStatusAction, convertQuoteToOrderAction, type FormState } from '@/actions/sales-quotes';

interface Line { productId: string; quantity: string; unitPrice: string; discountPercent: string; taxRatePercent: string }
const EMPTY_LINE: Line = { productId: '', quantity: '', unitPrice: '', discountPercent: '', taxRatePercent: '' };

export function CreateQuoteForm({ parties, products }: { parties: { id: string; legalName: string }[]; products: { id: string; sku: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createQuoteAction, undefined);
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
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni Teklif</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Cari</label>
          <select name="partyId" required style={{ padding: 6, minWidth: 160 }}>
            <option value="">Seçin</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Teklif Tarihi</label><input name="quoteDate" type="date" required style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Tarihi</label><input name="validUntil" type="date" style={{ padding: 6 }} /></div>
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
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Teklif Oluştur'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

const QUOTE_STATUS_LABELS: Record<string, string> = { SENT: 'Gönderildi', ACCEPTED: 'Kabul Edildi', REJECTED: 'Reddedildi', EXPIRED: 'Süresi Doldu' };

export function QuoteStatusButtons({ quoteId, status }: { quoteId: string; status: string }) {
  const [statusState, statusAction, statusPending] = useActionState<FormState, FormData>(setQuoteStatusAction, undefined);
  const [convertState, convertAction, convertPending] = useActionState<FormState, FormData>(convertQuoteToOrderAction, undefined);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {status !== 'CONVERTED' ? (
        <form action={statusAction} style={{ display: 'inline-flex', gap: 4 }}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <select name="status" defaultValue={status === 'DRAFT' ? 'SENT' : status} style={{ padding: '2px 4px', fontSize: 12 }}>
            {Object.entries(QUOTE_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <button type="submit" disabled={statusPending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{statusPending ? '...' : 'Güncelle'}</button>
        </form>
      ) : null}
      {status === 'ACCEPTED' ? (
        <form action={convertAction}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <button type="submit" disabled={convertPending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{convertPending ? '...' : 'Siparişe Dönüştür'}</button>
        </form>
      ) : null}
      {statusState?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{statusState.error}</span> : null}
      {convertState?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{convertState.error}</span> : null}
    </div>
  );
}
