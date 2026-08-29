'use client';

import { useActionState, useState } from 'react';
import { createProcRequestAction, type FormState } from '@/actions/procurement';

interface Line {
  productId: string;
  stockItemId: string;
  warehouseId: string;
  description: string;
  quantity: string;
  unitId: string;
  preferredBrand: string;
  estimatedUnitPrice: string;
  technicalSpec: string;
}

const EMPTY_LINE: Line = { productId: '', stockItemId: '', warehouseId: '', description: '', quantity: '', unitId: '', preferredBrand: '', estimatedUnitPrice: '', technicalSpec: '' };

export function ProcRequestForm({
  units, products, stockItems, warehouses, costCenters, budgetItems
}: {
  units: { id: string; code: string }[];
  products: { id: string; sku: string; name: string }[];
  stockItems: { id: string; sku: string; name: string }[];
  warehouses: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  budgetItems: { id: string; budgetName: string; accountName: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProcRequestAction, undefined);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const linesJson = JSON.stringify(
    lines
      .filter((l) => l.description && l.quantity && l.unitId)
      .map((l) => ({
        productId: l.productId || undefined,
        stockItemId: l.stockItemId || undefined,
        warehouseId: l.warehouseId || undefined,
        description: l.description,
        quantity: l.quantity,
        unitId: l.unitId,
        preferredBrand: l.preferredBrand || undefined,
        estimatedUnitPrice: l.estimatedUnitPrice || undefined,
        technicalSpec: l.technicalSpec || undefined
      }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="linesJson" value={linesJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni Satınalma Talebi</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Talep Türü</label>
          <select name="requestType" style={{ padding: 6 }}>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Acil</option>
            <option value="EMERGENCY">Çok Acil</option>
            <option value="PROJECT">Proje</option>
            <option value="PRODUCTION">Üretim</option>
            <option value="MAINTENANCE">Bakım</option>
            <option value="IT">BT</option>
            <option value="OFFICE">Ofis</option>
            <option value="RAW_MATERIAL">Hammadde</option>
            <option value="SERVICE">Hizmet</option>
            <option value="CAPEX">CAPEX</option>
            <option value="OPEX">OPEX</option>
            <option value="STOCK_REPLENISHMENT">Stok Tamamlama</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Öncelik</label>
          <select name="priority" style={{ padding: 6 }}>
            <option value="LOW">Düşük</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Yüksek</option>
            <option value="CRITICAL">Kritik</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>CAPEX/OPEX</label>
          <select name="capexOpex" style={{ padding: 6 }}>
            <option value="">—</option>
            <option value="CAPEX">CAPEX</option>
            <option value="OPEX">OPEX</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maliyet Merkezi</label>
          <select name="costCenterId" style={{ padding: 6 }}>
            <option value="">—</option>
            {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bütçe Kalemi</label>
          <select name="budgetItemId" style={{ padding: 6, minWidth: 180 }}>
            <option value="">— (bütçe takibi yok)</option>
            {budgetItems.map((b) => <option key={b.id} value={b.id}>{b.budgetName} — {b.accountName}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İstenen Teslim Tarihi</label>
          <input name="requestedDeliveryDate" type="date" style={{ padding: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label>
          <input name="currencyCode" defaultValue="TRY" style={{ padding: 6, width: 70 }} />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Gerekçe</label>
        <textarea name="justification" rows={2} style={{ padding: 6, width: '100%' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Kalemler</label>
        {lines.map((line, i) => (
          <div key={i} style={{ border: '1px solid #eee', borderRadius: 4, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Açıklama</label>
                <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ padding: 5, width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Miktar</label>
                <input value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ padding: 5, width: 80 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Birim</label>
                <select value={line.unitId} onChange={(e) => updateLine(i, { unitId: e.target.value })} style={{ padding: 5 }}>
                  <option value="">Seçin</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Tahmini Birim Fiyat</label>
                <input value={line.estimatedUnitPrice} onChange={(e) => updateLine(i, { estimatedUnitPrice: e.target.value })} style={{ padding: 5, width: 100 }} />
              </div>
              {lines.length > 1 ? <button type="button" onClick={() => removeLine(i)} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Master Ürün (opsiyonel)</label>
                <select value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} style={{ padding: 5, minWidth: 160 }}>
                  <option value="">—</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Stok Kartı (stok kontrolü için)</label>
                <select value={line.stockItemId} onChange={(e) => updateLine(i, { stockItemId: e.target.value })} style={{ padding: 5, minWidth: 160 }}>
                  <option value="">—</option>
                  {stockItems.map((s) => <option key={s.id} value={s.id}>{s.sku} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Depo (stok kartı seçiliyse zorunlu)</label>
                <select value={line.warehouseId} onChange={(e) => updateLine(i, { warehouseId: e.target.value })} style={{ padding: 5 }}>
                  <option value="">—</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Tercih Edilen Marka</label>
                <input value={line.preferredBrand} onChange={(e) => updateLine(i, { preferredBrand: e.target.value })} style={{ padding: 5, width: 140 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Teknik Şartname</label>
              <textarea value={line.technicalSpec} onChange={(e) => updateLine(i, { technicalSpec: e.target.value })} rows={1} style={{ padding: 5, width: '100%' }} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addLine} style={{ cursor: 'pointer', fontSize: 13 }}>+ Kalem Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'Talep Oluştur (Taslak)'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
