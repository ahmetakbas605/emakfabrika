'use client';

import { useActionState, useState } from 'react';
import {
  closeShiftAction,
  createStoreAction,
  openShiftAction,
  recordStoreSaleAction,
  type FormState
} from '@/actions/marketing-stores';

const FIELD: React.CSSProperties = { padding: 8, minWidth: 140 };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 };
const ROW: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: 16, marginBottom: 20 };

export function StoreCreateForm({
  departmentId,
  accountOptions
}: {
  departmentId: string;
  accountOptions: { id: string; code: string; name: string }[];
}) {
  const action = createStoreAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  // POS türü kendi kasasını tutar, bu yüzden hesap seçimi ister.
  // ORDER_INTAKE'te bu alanlar anlamsız — kullanıcı boşuna doldurmasın
  // diye koşullu gösteriliyor.
  const [storeType, setStoreType] = useState<'POS' | 'ORDER_INTAKE'>('ORDER_INTAKE');
  const isPos = storeType === 'POS';

  return (
    <form action={formAction} className="dim-card" style={ROW}>
      <div><label style={LABEL}>Kod</label><input name="code" required style={{ ...FIELD, minWidth: 100 }} placeholder="MGZ-1" /></div>
      <div><label style={LABEL}>Ad</label><input name="name" required style={FIELD} placeholder="Merkez Showroom" /></div>
      <div><label style={LABEL}>Konum</label><input name="location" style={FIELD} placeholder="Fabrika içi ofis" /></div>

      <div>
        <label style={LABEL}>Tür</label>
        <select name="storeType" required style={{ ...FIELD, minWidth: 200 }} value={storeType} onChange={(e) => setStoreType(e.target.value as 'POS' | 'ORDER_INTAKE')}>
          <option value="ORDER_INTAKE">Sipariş Alma Noktası</option>
          <option value="POS">Tezgâh Satışı (kendi kasası)</option>
        </select>
      </div>

      {isPos ? (
        <>
          <div style={{ minWidth: 220 }}>
            <label style={LABEL}>Kasa Muhasebe Hesabı (zorunlu)</label>
            <select name="accountingAccountId" required style={{ ...FIELD, width: '100%' }}>
              <option value="">Seçiniz</option>
              {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Satış Geliri Karşı Hesabı (zorunlu)</label>
            <input name="salesRevenueAccountCode" required style={{ ...FIELD, minWidth: 160 }} placeholder="600" />
          </div>
        </>
      ) : null}

      <button type="submit" disabled={pending}>{pending ? '...' : 'Mağaza Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function OpenShiftForm({ departmentId, storeId }: { departmentId: string; storeId: string }) {
  const action = openShiftAction.bind(null, departmentId, storeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button type="submit" disabled={pending} style={{ padding: '4px 12px', fontSize: 12 }}>{pending ? '...' : 'Vardiya Aç'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CloseShiftForm({ departmentId, shiftId }: { departmentId: string; shiftId: string }) {
  const action = closeShiftAction.bind(null, departmentId, shiftId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button type="submit" disabled={pending} style={{ padding: '4px 12px', fontSize: 12 }}>
        {pending ? '...' : 'Gün Sonu — Muhasebeye Aktar'}
      </button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 11 }}>{state.success}</span> : null}
    </form>
  );
}

export function StoreSaleForm({
  storeId,
  departmentId,
  partyOptions,
  productOptions
}: {
  storeId: string;
  departmentId: string;
  partyOptions: { id: string; legalName: string }[];
  productOptions: { id: string; name: string }[];
}) {
  const action = recordStoreSaleAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="storeId" value={storeId} />
      <select name="partyId" style={{ padding: 6, minWidth: 160 }}>
        <option value="">Gelip geçen müşteri</option>
        {partyOptions.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
      </select>
      <select name="productId" required style={{ padding: 6, minWidth: 160 }}>
        <option value="">Ürün</option>
        {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input name="quantity" type="number" step="0.001" required placeholder="Miktar" style={{ padding: 6, width: 90 }} />
      <input name="unitPrice" type="number" step="0.000001" required placeholder="Birim Fiyat" style={{ padding: 6, width: 110 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 14px' }}>{pending ? '...' : 'Sat'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12 }}>{state.success}</span> : null}
    </form>
  );
}
