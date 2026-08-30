'use client';

import { useActionState, useState } from 'react';
import { createTenderAwardAction, type FormState } from '@/actions/procurement-tender';

export interface TenderAwardCell { supplierPartyId: string; supplierName: string; tenderBidLineId: string; weightedTotal: number | null }
export interface TenderAwardLineOption { tenderLineId: string; description: string; quantity: string; unitCode: string; cells: TenderAwardCell[] }

interface Row { supplierPartyId: string; awardedQty: string }

// award-form.tsx:AwardCreateForm İLE AYNI desen (Faz 4, Faz 8C'de
// weightedTotal eklendi) — yalnızca quotationLineId yerine tenderBidLineId.
// Kasıtlı olarak AYRI bir bileşen — RFQ'nun award-form.tsx'i hiç değişmedi.
export function TenderAwardCreateForm({ tenderId, lines }: { tenderId: string; lines: TenderAwardLineOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTenderAwardAction, undefined);
  const [rowsByLine, setRowsByLine] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(lines.map((l) => [l.tenderLineId, l.cells.length > 0 ? [{ supplierPartyId: l.cells[0].supplierPartyId, awardedQty: l.quantity }] : []]))
  );

  function addRow(tenderLineId: string) {
    setRowsByLine((prev) => ({ ...prev, [tenderLineId]: [...(prev[tenderLineId] ?? []), { supplierPartyId: '', awardedQty: '' }] }));
  }
  function removeRow(tenderLineId: string, idx: number) {
    setRowsByLine((prev) => ({ ...prev, [tenderLineId]: prev[tenderLineId].filter((_, i) => i !== idx) }));
  }
  function updateRow(tenderLineId: string, idx: number, patch: Partial<Row>) {
    setRowsByLine((prev) => ({ ...prev, [tenderLineId]: prev[tenderLineId].map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  }

  const flatLines = lines.flatMap((line) =>
    (rowsByLine[line.tenderLineId] ?? [])
      .filter((r) => r.supplierPartyId && r.awardedQty)
      .map((r) => {
        const cell = line.cells.find((c) => c.supplierPartyId === r.supplierPartyId);
        return cell ? { tenderLineId: line.tenderLineId, supplierPartyId: r.supplierPartyId, tenderBidLineId: cell.tenderBidLineId, awardedQty: r.awardedQty } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  );

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <input type="hidden" name="linesJson" value={JSON.stringify(flatLines)} />

      {lines.map((line) => (
        <div key={line.tenderLineId} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{line.description} ({Number(line.quantity).toLocaleString('tr-TR')} {line.unitCode})</p>
          {(rowsByLine[line.tenderLineId] ?? []).map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
              <select value={row.supplierPartyId} onChange={(e) => updateRow(line.tenderLineId, idx, { supplierPartyId: e.target.value })} style={{ padding: 5, minWidth: 200 }}>
                <option value="">Tedarikçi seçin</option>
                {line.cells.map((c) => (
                  <option key={c.supplierPartyId} value={c.supplierPartyId}>{c.supplierName}{c.weightedTotal !== null ? ` — skor ${c.weightedTotal}` : ''}</option>
                ))}
              </select>
              <input value={row.awardedQty} onChange={(e) => updateRow(line.tenderLineId, idx, { awardedQty: e.target.value })} placeholder="Miktar" style={{ padding: 5, width: 90 }} />
              <button type="button" onClick={() => removeRow(line.tenderLineId, idx)} style={{ padding: '4px 8px', cursor: 'pointer' }}>Kaldır</button>
            </div>
          ))}
          <button type="button" onClick={() => addRow(line.tenderLineId)} style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>+ Tedarikçi Böl</button>
        </div>
      ))}

      <div>
        <button type="submit" disabled={pending || flatLines.length === 0} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ödül Taslağı Oluştur'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
