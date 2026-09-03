'use client';

import { useActionState, useState } from 'react';
import {
  cancelWeighbridgeTicketAction,
  createWeighbridgeAction,
  createWeighbridgeTicketAction,
  reverseWeighbridgeTicketAction,
  type FormState
} from '@/actions/marketing-weighbridge';

const FIELD: React.CSSProperties = { padding: 8, minWidth: 140 };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 };
const ROW: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: 16, marginBottom: 20 };

export function WeighbridgeForm({ departmentId }: { departmentId: string }) {
  const action = createWeighbridgeAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="dim-card" style={ROW}>
      <div><label style={LABEL}>Kod</label><input name="code" required style={{ ...FIELD, minWidth: 100 }} placeholder="KNT-1" /></div>
      <div><label style={LABEL}>Ad</label><input name="name" required style={FIELD} placeholder="Ana Kantar" /></div>
      <div><label style={LABEL}>Konum</label><input name="location" style={FIELD} placeholder="Fabrika girişi" /></div>
      <div><label style={LABEL}>Kapasite (kg)</label><input name="capacityKg" type="number" step="0.001" style={{ ...FIELD, minWidth: 120 }} /></div>
      <div>
        <label style={LABEL}>Karayolu Limiti (kg)</label>
        <input name="roadLegalLimitKg" type="number" step="0.001" style={{ ...FIELD, minWidth: 140 }} placeholder="40000" />
      </div>
      <div>
        <label style={LABEL}>Tolerans (%)</label>
        <input name="tolerancePercent" type="number" step="0.001" defaultValue="0" style={{ ...FIELD, minWidth: 100 }} />
      </div>
      <button type="submit" disabled={pending}>{pending ? '...' : 'Kantar Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function WeighbridgeTicketForm({
  departmentId,
  weighbridgeOptions,
  partyOptions,
  productOptions,
  orderLineOptions
}: {
  departmentId: string;
  weighbridgeOptions: { id: string; name: string }[];
  partyOptions: { id: string; legalName: string }[];
  productOptions: { id: string; name: string }[];
  orderLineOptions: { id: string; label: string }[];
}) {
  const action = createWeighbridgeTicketAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  // Kullanıcının kuralı: kg'lı ürün kantara TABİ (net kilo faturaya
  // gider) — bu durumda sipariş satırı zorunlu. Adetli üründe fiş
  // yalnızca karayolları tonaj kontrolü içindir, sipariş satırı istemez.
  const [purpose, setPurpose] = useState('SALES_QUANTITY');
  const isSalesQuantity = purpose === 'SALES_QUANTITY';

  return (
    <form action={formAction} className="dim-card" style={ROW}>
      <div>
        <label style={LABEL}>Kantar</label>
        <select name="weighbridgeId" required style={FIELD}>
          <option value="">Seçiniz</option>
          {weighbridgeOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div>
        <label style={LABEL}>Fiş Amacı</label>
        <select name="purpose" required style={{ ...FIELD, minWidth: 200 }} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          <option value="SALES_QUANTITY">Satış Miktarı (kg&#39;lı ürün)</option>
          <option value="ROAD_LEGAL_CHECK">Tonaj Kontrolü (adetli ürün)</option>
        </select>
      </div>

      <div>
        <label style={LABEL}>Yön</label>
        <select name="direction" style={{ ...FIELD, minWidth: 110 }} defaultValue="OUTBOUND">
          <option value="OUTBOUND">Çıkış</option>
          <option value="INBOUND">Giriş</option>
        </select>
      </div>

      <div><label style={LABEL}>Plaka</label><input name="plateNo" required style={{ ...FIELD, minWidth: 120 }} placeholder="34ABC123" /></div>
      <div><label style={LABEL}>Sürücü</label><input name="driverName" style={FIELD} /></div>
      <div><label style={LABEL}>Nakliyeci</label><input name="carrierName" style={FIELD} /></div>

      <div>
        <label style={LABEL}>Cari</label>
        <select name="partyId" style={{ ...FIELD, minWidth: 180 }}>
          <option value="">—</option>
          {partyOptions.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>

      <div>
        <label style={LABEL}>Ürün</label>
        <select name="productId" style={{ ...FIELD, minWidth: 180 }}>
          <option value="">—</option>
          {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ minWidth: 260 }}>
        <label style={LABEL}>Sipariş Satırı{isSalesQuantity ? ' (zorunlu)' : ''}</label>
        <select name="orderLineId" required={isSalesQuantity} style={{ ...FIELD, minWidth: 260 }}>
          <option value="">—</option>
          {orderLineOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <div><label style={LABEL}>Brüt / Dolu (kg)</label><input name="grossKg" type="number" step="0.001" style={{ ...FIELD, minWidth: 130 }} /></div>
      <div><label style={LABEL}>Dara / Boş (kg)</label><input name="tareKg" type="number" step="0.001" style={{ ...FIELD, minWidth: 130 }} /></div>

      <div style={{ flex: '1 1 100%' }}>
        <label style={LABEL}>Not</label>
        <input name="notes" style={{ ...FIELD, width: '100%' }} />
      </div>

      <button type="submit" disabled={pending}>{pending ? 'Kaydediliyor...' : 'Fiş Kes'}</button>
      <span className="dim-technical" style={{ color: 'var(--dim-slate)' }}>
        Net = Brüt − Dara. İkisi de girilirse fiş tamamlanır, biri eksikse taslak kalır.
      </span>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

// İptal ve ters kayıt AYRI formlar — ikisi de sebep ister, ikisi de
// farklı yetkiye tabi (cancel vs correct_weighing).
export function TicketCancelForm({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = cancelWeighbridgeTicketAction.bind(null, departmentId, ticketId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 4 }}>
      <input name="reason" required placeholder="İptal sebebi" style={{ padding: 4, fontSize: 12, minWidth: 120 }} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12 }}>{pending ? '...' : 'İptal'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function TicketReverseForm({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = reverseWeighbridgeTicketAction.bind(null, departmentId, ticketId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 4 }}>
      <input name="reason" required placeholder="Ters kayıt sebebi" style={{ padding: 4, fontSize: 12, minWidth: 130 }} />
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12 }}>{pending ? '...' : 'Ters Kayıt'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
