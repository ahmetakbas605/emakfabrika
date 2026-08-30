'use client';

import { useActionState, useState } from 'react';
import { createBomAction, type FormState } from '@/actions/production-bom';

interface Line { componentProductId: string; quantity: string; unitId: string; scrapPercent: string }
const EMPTY_LINE: Line = { componentProductId: '', quantity: '', unitId: '', scrapPercent: '' };

export function CreateBomForm({ products, units }: { products: { id: string; sku: string; name: string }[]; units: { id: string; code: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createBomAction, undefined);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const linesJson = JSON.stringify(
    lines
      .filter((l) => l.componentProductId && l.quantity && l.unitId)
      .map((l) => ({ componentProductId: l.componentProductId, quantity: Number(l.quantity), unitId: l.unitId, scrapPercent: l.scrapPercent ? Number(l.scrapPercent) : undefined }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="linesJson" value={linesJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni BOM (Ürün Ağacı)</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üretilen Ürün</label>
          <select name="productId" required style={{ padding: 6, minWidth: 180 }}>
            <option value="">Seçin</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>BOM Kodu</label><input name="code" required style={{ padding: 6, width: 120 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 160 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Baz Miktar</label><input name="baseQuantity" type="number" step="0.01" defaultValue="1" style={{ padding: 6, width: 80 }} /></div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Baz Birim</label>
          <select name="unitId" required style={{ padding: 6, minWidth: 90 }}>
            <option value="">Seçin</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Başlangıcı</label><input name="effectiveFrom" type="date" style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Bitişi</label><input name="effectiveTo" type="date" style={{ padding: 6 }} /></div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Bileşenler</label>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
            <div style={{ minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Bileşen Ürün</label>
              <select value={line.componentProductId} onChange={(e) => updateLine(i, { componentProductId: e.target.value })} style={{ padding: 5, width: '100%' }}>
                <option value="">Seçin</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Miktar</label><input value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ padding: 5, width: 80 }} /></div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Birim</label>
              <select value={line.unitId} onChange={(e) => updateLine(i, { unitId: e.target.value })} style={{ padding: 5 }}>
                <option value="">Seçin</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Fire %</label><input value={line.scrapPercent} onChange={(e) => updateLine(i, { scrapPercent: e.target.value })} style={{ padding: 5, width: 70 }} /></div>
            {lines.length > 1 ? <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
          </div>
        ))}
        <button type="button" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])} style={{ cursor: 'pointer', fontSize: 13 }}>+ Bileşen Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'BOM Oluştur'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
