'use client';

import { useActionState } from 'react';
import {
  addContractLineAction,
  createContractAction,
  createOrderFromContractAction,
  transitionContractAction,
  type FormState
} from '@/actions/marketing-contracts';

const FIELD: React.CSSProperties = { padding: 8, minWidth: 150 };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 };
const ROW: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: 16, marginBottom: 20 };

const DELIVERY_TERM_LABELS: Record<string, string> = {
  EX_WORKS: 'Fabrika Teslim',
  DELIVERED: 'Adrese Teslim',
  FOB: 'FOB',
  CIF: 'CIF',
  OTHER: 'Diğer'
};

function DeliveryTermSelect({ name = 'deliveryTerm' }: { name?: string }) {
  return (
    <select name={name} style={{ ...FIELD, minWidth: 150 }} defaultValue="EX_WORKS">
      {Object.entries(DELIVERY_TERM_LABELS).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

export function ContractCreateForm({
  departmentId,
  partyOptions,
  productOptions,
  currencyOptions
}: {
  departmentId: string;
  partyOptions: { id: string; legalName: string }[];
  productOptions: { id: string; name: string }[];
  currencyOptions: { code: string }[];
}) {
  const action = createContractAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="dim-card" style={ROW}>
      <div style={{ minWidth: 220 }}>
        <label style={LABEL}>Sözleşme Başlığı</label>
        <input name="title" required style={{ ...FIELD, width: '100%' }} placeholder="2026 Yıllık Çimento Anlaşması" />
      </div>

      <div>
        <label style={LABEL}>Cari</label>
        <select name="partyId" required style={{ ...FIELD, minWidth: 180 }}>
          <option value="">Seçiniz</option>
          {partyOptions.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>

      <div>
        <label style={LABEL}>Para Birimi</label>
        <select name="currencyCode" required style={{ ...FIELD, minWidth: 100 }}>
          <option value="">—</option>
          {currencyOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>

      <div><label style={LABEL}>Başlangıç</label><input name="startDate" type="date" style={FIELD} /></div>
      <div><label style={LABEL}>Bitiş</label><input name="endDate" type="date" style={FIELD} /></div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--dim-on-surface-variant)' }}>
        <input name="counterpartyIsContractor" type="checkbox" />
        Karşı taraf müteahhit
      </label>

      <div style={{ minWidth: 200 }}>
        <label style={LABEL}>Karşı Taraf İmzacısı (opsiyonel)</label>
        <input name="counterpartySignatory" style={{ ...FIELD, width: '100%' }} />
      </div>

      <div style={{ flex: '1 1 100%', borderTop: '1px solid var(--dim-border-faint)', paddingTop: 12, marginTop: 4 }}>
        <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>İlk Kalem</span>
      </div>

      <div>
        <label style={LABEL}>Ürün</label>
        <select name="productId" required style={{ ...FIELD, minWidth: 180 }}>
          <option value="">Seçiniz</option>
          {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div><label style={LABEL}>Miktar</label><input name="quantity" type="number" step="0.001" required style={{ ...FIELD, minWidth: 100 }} /></div>
      <div><label style={LABEL}>Birim Fiyat</label><input name="unitPrice" type="number" step="0.000001" required style={{ ...FIELD, minWidth: 120 }} /></div>
      <div><label style={LABEL}>Teslim Şartı</label><DeliveryTermSelect /></div>
      <div style={{ minWidth: 200 }}>
        <label style={LABEL}>Teslim Notu</label>
        <input name="deliveryNote" style={{ ...FIELD, width: '100%' }} />
      </div>

      <div style={{ flex: '1 1 100%' }}>
        <label style={LABEL}>Genel Not</label>
        <input name="notes" style={{ ...FIELD, width: '100%' }} />
      </div>

      <button type="submit" disabled={pending}>{pending ? 'Kaydediliyor...' : 'Sözleşme Taslağı Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ContractLineForm({ departmentId, contractId, productOptions }: {
  departmentId: string;
  contractId: string;
  productOptions: { id: string; name: string }[];
}) {
  const action = addContractLineAction.bind(null, departmentId, contractId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <select name="productId" required style={{ padding: 6, minWidth: 160 }}>
        <option value="">Ürün</option>
        {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input name="quantity" type="number" step="0.001" required placeholder="Miktar" style={{ padding: 6, width: 90 }} />
      <input name="unitPrice" type="number" step="0.000001" required placeholder="Birim Fiyat" style={{ padding: 6, width: 100 }} />
      <select name="deliveryTerm" style={{ padding: 6, minWidth: 130 }} defaultValue="EX_WORKS">
        {Object.entries(DELIVERY_TERM_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', fontSize: 12 }}>{pending ? '...' : 'Kalem Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: 'Onaya Sun',
  BACK_TO_DRAFT: 'Taslağa Döndür',
  SIGN: 'İmzala',
  ACTIVATE: 'Yürürlüğe Al',
  EXPIRE: 'Süresini Sonlandır',
  TERMINATE: 'Feshet'
};

// İmza ve fesih ek bir alan ister (imzacı adı / fesih sebebi); diğer
// eylemler tek tıkla çalışır. Aynı formda ikisini de göstermek yerine
// yalnızca aksiyona uygun alanı açıyoruz — kullanıcı boş bir "sebep"
// kutusuyla karşılaşıp kafası karışmasın.
export function ContractActionForm({
  departmentId,
  contractId,
  action: actionName
}: {
  departmentId: string;
  contractId: string;
  action: 'SUBMIT' | 'SIGN' | 'ACTIVATE' | 'EXPIRE' | 'TERMINATE' | 'BACK_TO_DRAFT';
}) {
  const boundAction = transitionContractAction.bind(null, departmentId, contractId, actionName);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {actionName === 'SIGN' ? (
        <input name="counterpartySignatory" placeholder="İmzacı adı" style={{ padding: 4, fontSize: 12, width: 120 }} />
      ) : null}
      {actionName === 'TERMINATE' ? (
        <input name="terminationReason" required placeholder="Fesih sebebi" style={{ padding: 4, fontSize: 12, width: 140 }} />
      ) : null}
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12 }}>
        {pending ? '...' : ACTION_LABELS[actionName]}
      </button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateOrderFromContractForm({ departmentId, contractId }: { departmentId: string; contractId: string }) {
  const action = createOrderFromContractAction.bind(null, departmentId, contractId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button type="submit" disabled={pending} style={{ padding: '4px 10px', fontSize: 12 }}>
        {pending ? '...' : 'Siparişe Dönüştür'}
      </button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 11 }}>{state.success}</span> : null}
    </form>
  );
}
