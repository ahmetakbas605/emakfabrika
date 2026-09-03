'use client';

import { useActionState, useState } from 'react';
import { createRoutingAction, type FormState } from '@/actions/production-routing';

interface Op { workCenterId: string; name: string; setupTimeMinutes: string; runTimeMinutesPerUnit: string }
const EMPTY_OP: Op = { workCenterId: '', name: '', setupTimeMinutes: '', runTimeMinutesPerUnit: '' };

export function CreateRoutingForm({ products, workCenters }: { products: { id: string; sku: string; name: string }[]; workCenters: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRoutingAction, undefined);
  const [ops, setOps] = useState<Op[]>([{ ...EMPTY_OP }]);

  function updateOp(i: number, patch: Partial<Op>) {
    setOps((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  const operationsJson = JSON.stringify(
    ops
      .filter((o) => o.workCenterId && o.name)
      .map((o) => ({ workCenterId: o.workCenterId, name: o.name, setupTimeMinutes: o.setupTimeMinutes ? Number(o.setupTimeMinutes) : undefined, runTimeMinutesPerUnit: o.runTimeMinutesPerUnit ? Number(o.runTimeMinutesPerUnit) : undefined }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid var(--dim-border-soft)', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="operationsJson" value={operationsJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni Routing (Rota)</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Üretilen Ürün</label>
          <select name="productId" required style={{ padding: 6, minWidth: 180 }}>
            <option value="">Seçin</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Routing Kodu</label><input name="code" required style={{ padding: 6, width: 120 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label><input name="name" required style={{ padding: 6, width: 160 }} /></div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 6 }}>Operasyonlar (sıralı)</label>
        {ops.map((op, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--dim-slate)', width: 16 }}>{i + 1}.</span>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>İş Merkezi</label>
              <select value={op.workCenterId} onChange={(e) => updateOp(i, { workCenterId: e.target.value })} style={{ padding: 5, minWidth: 140 }}>
                <option value="">Seçin</option>
                {workCenters.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
            <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Operasyon Adı</label><input value={op.name} onChange={(e) => updateOp(i, { name: e.target.value })} style={{ padding: 5, width: 150 }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Hazırlık (dk)</label><input value={op.setupTimeMinutes} onChange={(e) => updateOp(i, { setupTimeMinutes: e.target.value })} style={{ padding: 5, width: 70 }} /></div>
            <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Birim Süre (dk)</label><input value={op.runTimeMinutesPerUnit} onChange={(e) => updateOp(i, { runTimeMinutesPerUnit: e.target.value })} style={{ padding: 5, width: 80 }} /></div>
            {ops.length > 1 ? <button type="button" onClick={() => setOps((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
          </div>
        ))}
        <button type="button" onClick={() => setOps((prev) => [...prev, { ...EMPTY_OP }])} style={{ cursor: 'pointer', fontSize: 13 }}>+ Operasyon Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Routing Oluştur'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
