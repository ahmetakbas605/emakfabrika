'use client';

import { useActionState, useState } from 'react';
import { createRfqAction, type FormState } from '@/actions/procurement-rfq';

interface QueueItem { lineId: string; requestNo: string; description: string; quantity: string; unitId: string; unitCode: string; productId: string | null }
interface ManualLine { description: string; quantity: string; unitId: string }

export function RfqCreateForm({
  queueItems, units, suppliers
}: {
  queueItems: QueueItem[];
  units: { id: string; code: string }[];
  suppliers: { id: string; legalName: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRfqAction, undefined);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());

  function toggleQueueItem(lineId: string) {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }
  function toggleSupplier(id: string) {
    setSelectedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function addManualLine() {
    setManualLines((prev) => [...prev, { description: '', quantity: '', unitId: units[0]?.id ?? '' }]);
  }
  function updateManualLine(i: number, patch: Partial<ManualLine>) {
    setManualLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeManualLine(i: number) {
    setManualLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const linesJson = JSON.stringify([
    ...queueItems.filter((q) => selectedQueueIds.has(q.lineId)).map((q) => ({ srcRequestLineId: q.lineId, productId: q.productId ?? undefined, description: q.description, quantity: q.quantity, unitId: q.unitId })),
    ...manualLines.filter((l) => l.description && l.quantity && l.unitId).map((l) => ({ description: l.description, quantity: l.quantity, unitId: l.unitId }))
  ]);
  const suppliersJson = JSON.stringify([...selectedSuppliers]);

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="linesJson" value={linesJson} />
      <input type="hidden" name="suppliersJson" value={suppliersJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni RFQ (Teklif Talebi)</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlık</label>
          <input name="title" required style={{ padding: 6, width: 240 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Teklif Son Tarihi</label>
          <input name="quotationDeadline" type="datetime-local" style={{ padding: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Teslimat Yeri</label>
          <input name="deliveryLocation" style={{ padding: 6, width: 160 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ödeme Koşulu</label>
          <input name="paymentTerms" style={{ padding: 6, width: 140 }} />
        </div>
      </div>

      {queueItems.length > 0 ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Satınalma Kuyruğundan Seç (madde 47-50 — farklı taleplerden satırlar birleştirilebilir)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
            {queueItems.map((q) => (
              <label key={q.lineId} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={selectedQueueIds.has(q.lineId)} onChange={() => toggleQueueItem(q.lineId)} />
                {q.requestNo} — {q.description} ({Number(q.quantity).toLocaleString('tr-TR')} {q.unitCode})
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Doğrudan Kalem Ekle (bir talebe bağlı değil)</label>
        {manualLines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input value={line.description} onChange={(e) => updateManualLine(i, { description: e.target.value })} placeholder="Açıklama" style={{ padding: 5, flex: 1 }} />
            <input value={line.quantity} onChange={(e) => updateManualLine(i, { quantity: e.target.value })} placeholder="Miktar" style={{ padding: 5, width: 90 }} />
            <select value={line.unitId} onChange={(e) => updateManualLine(i, { unitId: e.target.value })} style={{ padding: 5 }}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
            <button type="button" onClick={() => removeManualLine(i)} style={{ cursor: 'pointer' }}>Kaldır</button>
          </div>
        ))}
        <button type="button" onClick={addManualLine} style={{ cursor: 'pointer', fontSize: 13 }}>+ Kalem Ekle</button>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Davet Edilecek Tedarikçiler</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {suppliers.map((s) => (
            <label key={s.id} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={selectedSuppliers.has(s.id)} onChange={() => toggleSupplier(s.id)} />
              {s.legalName}
            </label>
          ))}
          {suppliers.length === 0 ? <span style={{ fontSize: 12, color: '#b00' }}>Önce Master Data → Cariler'de tedarikçi rolüyle bir cari kartı oluşturun.</span> : null}
        </div>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'RFQ Oluştur'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
