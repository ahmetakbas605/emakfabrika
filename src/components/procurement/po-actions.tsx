'use client';

import { useActionState } from 'react';
import { createPurchaseOrdersFromAwardAction, issuePurchaseOrderAction, acknowledgePurchaseOrderAction, cancelPurchaseOrderAction, addPoAttachmentAction, type FormState } from '@/actions/procurement-po';

export function CreatePurchaseOrdersButton({ awardId }: { awardId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPurchaseOrdersFromAwardAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="awardId" value={awardId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Sipariş(ler) Oluştur'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 12 }}>{state.success}</span> : null}
    </form>
  );
}

export function IssuePoButton({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(issuePurchaseOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="poId" value={poId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Tedarikçiye Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function AcknowledgePoButton({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(acknowledgePurchaseOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="poId" value={poId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Tedarikçi Onayını İşaretle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelPoButton({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelPurchaseOrderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="poId" value={poId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function PoAttachmentForm({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPoAttachmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="poId" value={poId} />
      <input type="file" name="file" required style={{ fontSize: 11 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>{pending ? '...' : 'Sözleşme/Dosya Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 10 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 10 }}>{state.success}</span> : null}
    </form>
  );
}
