'use client';

import { useActionState } from 'react';
import { issueProductionMaterialsAction, startProdOperationAction, completeProdOperationAction, completeProductionOrderAction, type FormState } from '@/actions/production-execution';

export function IssueMaterialsForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(issueProductionMaterialsAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 8, borderRadius: 4 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Tarih</label><input name="transactionDate" type="date" required style={{ padding: 5 }} /></div>
      <input name="counterAccountCode" placeholder="WIP hesabı (ops.)" style={{ padding: 5, width: 120, fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Malzeme Çıkışı Yap'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 11, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}

// Holding ERP Faz 4 (MES) — machines OPSİYONEL prop, boş geçilirse (Faz 2'nin
// eski çağıranları hâlâ derlenir) makine seçici hiç render edilmez.
export function StartOperationButton({ operationId, machines }: { operationId: string; machines?: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startProdOperationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginRight: 6 }}>
      <input type="hidden" name="operationId" value={operationId} />
      {machines && machines.length > 0 ? (
        <select name="machineId" style={{ padding: '2px 4px', fontSize: 12 }}>
          <option value="">— makine seçilmedi —</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
      ) : null}
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Başlat'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CompleteOperationForm({ operationId }: { operationId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeProdOperationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="operationId" value={operationId} />
      <input name="goodQuantity" type="number" step="0.01" placeholder="İyi" required style={{ padding: 4, width: 60, fontSize: 12 }} />
      <input name="scrapQuantity" type="number" step="0.01" placeholder="Fire" style={{ padding: 4, width: 60, fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Tamamla'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CompleteProductionOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeProductionOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 8, borderRadius: 4 }}>
      <input type="hidden" name="orderId" value={orderId} />
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>İyi Miktar</label><input name="goodQuantity" type="number" step="0.01" required style={{ padding: 5, width: 80 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Fire Miktarı</label><input name="scrapQuantity" type="number" step="0.01" style={{ padding: 5, width: 80 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Tarih</label><input name="transactionDate" type="date" required style={{ padding: 5 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: 'var(--dim-on-surface-variant)' }}>Birim Maliyet (ops.)</label><input name="unitCost" type="number" step="0.01" style={{ padding: 5, width: 90 }} /></div>
      <input name="counterAccountCode" placeholder="WIP hesabı (ops.)" style={{ padding: 5, width: 110, fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Üretimi Tamamla (Mamul Girişi)'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 11, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
