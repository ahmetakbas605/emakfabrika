'use client';

import { useState, useActionState } from 'react';
import {
  recordInspectionAction, createNcrAction, startNcrInvestigationAction, recordNcrRootCauseAction, recordNcrActionsAction, closeNcrAction, rejectNcrAction, type FormState
} from '@/actions/quality';

type IncomingSource = { id: string; receiptNo: string; description: string; receivedQty: string; supplierName: string };
type ProcessSource = { id: string; name: string; orderNo: string; productName: string };
type FinalSource = { id: string; orderNo: string; productName: string; quantity: string };
type ProductOption = { id: string; sku: string; name: string };

const SOURCE_TYPE_BY_INSPECTION_TYPE: Record<string, string> = { INCOMING: 'PROC_RECEIPT_LINE', IN_PROCESS: 'PROD_OPERATION', FINAL: 'PRODUCTION_ORDER' };

export function RecordInspectionForm({ incomingSources, processSources, finalSources, products }: {
  incomingSources: IncomingSource[]; processSources: ProcessSource[]; finalSources: FinalSource[]; products: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordInspectionAction, undefined);
  const [type, setType] = useState<'INCOMING' | 'IN_PROCESS' | 'FINAL'>('INCOMING');

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="sourceType" value={SOURCE_TYPE_BY_INSPECTION_TYPE[type]} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)} style={{ padding: 6 }}>
          <option value="INCOMING">Giriş</option>
          <option value="IN_PROCESS">Proses</option>
          <option value="FINAL">Final</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kaynak Kayıt</label>
        <select name="sourceId" required style={{ padding: 6, minWidth: 220 }}>
          <option value="">Seçin</option>
          {type === 'INCOMING' && incomingSources.map((s) => <option key={s.id} value={s.id}>{s.receiptNo} — {s.supplierName} — {s.description} ({s.receivedQty})</option>)}
          {type === 'IN_PROCESS' && processSources.map((s) => <option key={s.id} value={s.id}>{s.orderNo} — {s.name} — {s.productName}</option>)}
          {type === 'FINAL' && finalSources.map((s) => <option key={s.id} value={s.id}>{s.orderNo} — {s.productName} ({s.quantity})</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ürün (ops.)</label>
        <select name="productId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Muayene Edilen</label><input name="inspectedQty" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçen</label><input name="passedQty" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ret</label><input name="failedQty" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Sonuç</label>
        <select name="result" required style={{ padding: 6 }}>
          <option value="PASS">Kabul</option>
          <option value="CONDITIONAL">Şartlı Kabul</option>
          <option value="FAIL">Ret</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Not (ops.)</label><input name="notes" style={{ padding: 6, width: 160 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Muayene Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateNcrForm({ failedInspections, suppliers, products }: {
  failedInspections: { id: string; inspectionNo: string; productName: string | null }[];
  suppliers: { id: string; legalName: string }[];
  products: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createNcrAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İlgili Muayene (ops.)</label>
        <select name="inspectionId" style={{ padding: 6, minWidth: 160 }}>
          <option value="">Yok</option>
          {failedInspections.map((i) => <option key={i.id} value={i.id}>{i.inspectionNo}{i.productName ? ` — ${i.productName}` : ''}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tedarikçi (ops.)</label>
        <select name="supplierPartyId" style={{ padding: 6, minWidth: 160 }}>
          <option value="">Yok</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ürün (ops.)</label>
        <select name="productId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlık</label><input name="title" required style={{ padding: 6, width: 200 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label><input name="description" required style={{ padding: 6, width: 260 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Önem</label>
        <select name="severity" style={{ padding: 6 }}>
          <option value="MINOR">Düşük</option>
          <option value="MAJOR">Orta</option>
          <option value="CRITICAL">Kritik</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'NCR Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function StartNcrInvestigationButton({ ncrId }: { ncrId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startNcrInvestigationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="ncrId" value={ncrId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Soruşturmayı Başlat'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function RecordNcrRootCauseForm({ ncrId }: { ncrId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordNcrRootCauseAction, undefined);
  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="ncrId" value={ncrId} />
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Kök Neden</label>
      <textarea name="rootCause" required rows={3} style={{ width: '100%', padding: 6, marginBottom: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kök Nedeni Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
    </form>
  );
}

export function RecordNcrActionsForm({ ncrId }: { ncrId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordNcrActionsAction, undefined);
  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="ncrId" value={ncrId} />
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Düzeltici Faaliyet</label>
      <textarea name="correctiveAction" required rows={2} style={{ width: '100%', padding: 6, marginBottom: 8 }} />
      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Önleyici Faaliyet</label>
      <textarea name="preventiveAction" required rows={2} style={{ width: '100%', padding: 6, marginBottom: 8 }} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
    </form>
  );
}

export function CloseNcrButton({ ncrId }: { ncrId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeNcrAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="ncrId" value={ncrId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'NCR\'yi Kapat'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function RejectNcrButton({ ncrId }: { ncrId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(rejectNcrAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginLeft: 8 }}>
      <input type="hidden" name="ncrId" value={ncrId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Reddet'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}
