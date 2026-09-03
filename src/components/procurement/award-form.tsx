'use client';

import { useActionState, useState } from 'react';
import { createAwardAction, submitAwardAction, cancelAwardAction, type FormState } from '@/actions/procurement-award';

export interface AwardLineCell { supplierPartyId: string; supplierName: string; quotationLineId: string; weightedTotal: number | null }
export interface AwardLineOption { rfqLineId: string; description: string; quantity: string; unitCode: string; cells: AwardLineCell[] }

interface Row { supplierPartyId: string; awardedQty: string }

// madde 75-77 — bölünmüş ödül: her RFQ kalemi için BİRDEN FAZLA satır
// (farklı tedarikçi + kendi miktarı) eklenebilir. Varsayılan: en yüksek
// ağırlıklı skora sahip tedarikçiye TAM miktar (kullanıcı değiştirebilir —
// motor otomatik seçmiyor, madde 141'in "öneri, karar değil" ilkesi).
export function AwardCreateForm({ rfqId, lines }: { rfqId: string; lines: AwardLineOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createAwardAction, undefined);
  const [rowsByLine, setRowsByLine] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(lines.map((l) => [l.rfqLineId, l.cells.length > 0 ? [{ supplierPartyId: l.cells[0].supplierPartyId, awardedQty: l.quantity }] : []]))
  );

  function addRow(rfqLineId: string) {
    setRowsByLine((prev) => ({ ...prev, [rfqLineId]: [...(prev[rfqLineId] ?? []), { supplierPartyId: '', awardedQty: '' }] }));
  }
  function removeRow(rfqLineId: string, idx: number) {
    setRowsByLine((prev) => ({ ...prev, [rfqLineId]: prev[rfqLineId].filter((_, i) => i !== idx) }));
  }
  function updateRow(rfqLineId: string, idx: number, patch: Partial<Row>) {
    setRowsByLine((prev) => ({ ...prev, [rfqLineId]: prev[rfqLineId].map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  }

  const flatLines = lines.flatMap((line) =>
    (rowsByLine[line.rfqLineId] ?? [])
      .filter((r) => r.supplierPartyId && r.awardedQty)
      .map((r) => {
        const cell = line.cells.find((c) => c.supplierPartyId === r.supplierPartyId);
        return cell ? { rfqLineId: line.rfqLineId, supplierPartyId: r.supplierPartyId, quotationLineId: cell.quotationLineId, awardedQty: r.awardedQty } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  );

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="linesJson" value={JSON.stringify(flatLines)} />

      {lines.map((line) => (
        <div key={line.rfqLineId} style={{ border: '1px solid var(--dim-border-soft)', borderRadius: 6, padding: 10 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{line.description} ({Number(line.quantity).toLocaleString('tr-TR')} {line.unitCode})</p>
          {(rowsByLine[line.rfqLineId] ?? []).map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
              <select value={row.supplierPartyId} onChange={(e) => updateRow(line.rfqLineId, idx, { supplierPartyId: e.target.value })} style={{ padding: 5, minWidth: 200 }}>
                <option value="">Tedarikçi seçin</option>
                {line.cells.map((c) => (
                  <option key={c.supplierPartyId} value={c.supplierPartyId}>{c.supplierName}{c.weightedTotal !== null ? ` — skor ${c.weightedTotal}` : ''}</option>
                ))}
              </select>
              <input value={row.awardedQty} onChange={(e) => updateRow(line.rfqLineId, idx, { awardedQty: e.target.value })} placeholder="Miktar" style={{ padding: 5, width: 90 }} />
              <button type="button" onClick={() => removeRow(line.rfqLineId, idx)} style={{ padding: '4px 8px', cursor: 'pointer' }}>Kaldır</button>
            </div>
          ))}
          <button type="button" onClick={() => addRow(line.rfqLineId)} style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>+ Tedarikçi Böl</button>
        </div>
      ))}

      <div>
        <button type="submit" disabled={pending || flatLines.length === 0} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ödül Taslağı Oluştur'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function SubmitAwardButton({ awardId }: { awardId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitAwardAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="awardId" value={awardId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Onaya Gönder'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelAwardButton({ awardId }: { awardId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelAwardAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="awardId" value={awardId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
