'use client';

import { useActionState, useState } from 'react';
import { submitQuotationAction, sendRfqAction, closeRfqAction, type FormState } from '@/actions/procurement-rfq';

interface Line { rfqLineId: string; unitPrice: string; discountPercent: string; deliveryDays: string; isAlternative: boolean; alternativeDescription: string }

export function QuotationForm({ rfqId, rfqLines, suppliers }: { rfqId: string; rfqLines: { id: string; description: string }[]; suppliers: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitQuotationAction, undefined);
  const [supplierPartyId, setSupplierPartyId] = useState('');
  const [lines, setLines] = useState<Line[]>(rfqLines.map((l) => ({ rfqLineId: l.id, unitPrice: '', discountPercent: '', deliveryDays: '', isAlternative: false, alternativeDescription: '' })));

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const linesJson = JSON.stringify(
    lines.filter((l) => l.unitPrice).map((l) => ({ rfqLineId: l.rfqLineId, unitPrice: l.unitPrice, discountPercent: l.discountPercent || undefined, deliveryDays: l.deliveryDays || undefined, isAlternative: l.isAlternative ? 'on' : undefined, alternativeDescription: l.alternativeDescription || undefined }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 14, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="linesJson" value={linesJson} />
      <h4 style={{ fontSize: 13, margin: 0 }}>Teklif Gir</h4>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select name="supplierPartyId" value={supplierPartyId} onChange={(e) => setSupplierPartyId(e.target.value)} required style={{ padding: 6 }}>
          <option value="">Tedarikçi seçin</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
        </select>
        <input name="currencyCode" defaultValue="TRY" style={{ padding: 6, width: 70 }} />
        <input name="deliveryDays" type="number" placeholder="Genel teslim (gün)" style={{ padding: 6, width: 140 }} />
        <input name="validUntil" type="date" style={{ padding: 6 }} />
        <input name="paymentTerms" placeholder="Ödeme koşulu" style={{ padding: 6, width: 140 }} />
      </div>

      {lines.map((line, i) => (
        <div key={line.rfqLineId} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ minWidth: 160 }}>{rfqLines[i]?.description}</span>
          <input value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} placeholder="Birim Fiyat" style={{ padding: 5, width: 90 }} />
          <input value={line.discountPercent} onChange={(e) => updateLine(i, { discountPercent: e.target.value })} placeholder="İndirim %" style={{ padding: 5, width: 70 }} />
          <input value={line.deliveryDays} onChange={(e) => updateLine(i, { deliveryDays: e.target.value })} placeholder="Teslim (gün)" style={{ padding: 5, width: 90 }} />
          <label style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <input type="checkbox" checked={line.isAlternative} onChange={(e) => updateLine(i, { isAlternative: e.target.checked })} /> Alternatif
          </label>
          {line.isAlternative ? <input value={line.alternativeDescription} onChange={(e) => updateLine(i, { alternativeDescription: e.target.value })} placeholder="Alternatif açıklama" style={{ padding: 5, width: 160 }} /> : null}
        </div>
      ))}

      <div>
        <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Teklifi Kaydet'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function SendRfqButton({ rfqId }: { rfqId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(sendRfqAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Tedarikçilere Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function CloseRfqButton({ rfqId }: { rfqId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeRfqAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Teklif Toplamayı Kapat'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
