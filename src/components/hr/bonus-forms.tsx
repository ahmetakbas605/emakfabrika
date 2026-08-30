'use client';

import { useActionState } from 'react';
import { createBonusRequestAction, submitBonusRequestAction, cancelBonusRequestAction, reviseApprovedBonusAction, type FormState } from '@/actions/hr-bonus';

const BONUS_TYPE_LABELS: Record<string, string> = { PERFORMANCE: 'Performans', HOLIDAY: 'Bayram/Tatil', REFERRAL: 'Referans', RETENTION: 'Elde Tutma', OTHER: 'Diğer' };

export function BonusForm({ departmentId, employeeId, currencies }: { departmentId: string; employeeId: string; currencies: { code: string; name: string }[] }) {
  const action = createBonusRequestAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="bonusType" required style={{ padding: 6, width: 150 }}>{Object.entries(BONUS_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tutar</label><input name="amount" type="number" step="0.01" min={0} required style={{ padding: 6, width: 120 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label>
        <select name="currencyCode" required style={{ padding: 6, width: 90 }}>{currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
      </div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Gerekçe</label><textarea name="reason" rows={2} style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Taslak Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function SubmitBonusButton({ departmentId, employeeId, bonusRequestId }: { departmentId: string; employeeId: string; bonusRequestId: string }) {
  const action = submitBonusRequestAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginRight: 6 }}>
      <input type="hidden" name="bonusRequestId" value={bonusRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Gönder'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelBonusButton({ departmentId, employeeId, bonusRequestId }: { departmentId: string; employeeId: string; bonusRequestId: string }) {
  const action = cancelBonusRequestAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="bonusRequestId" value={bonusRequestId} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer', color: '#b00' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
    </form>
  );
}

export function ReviseBonusForm({ departmentId, employeeId, bonusRequestId }: { departmentId: string; employeeId: string; bonusRequestId: string }) {
  const action = reviseApprovedBonusAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="bonusRequestId" value={bonusRequestId} />
      <input name="newAmount" type="number" step="0.01" min={0} placeholder="Yeni tutar" required style={{ padding: '2px 6px', width: 90, fontSize: 12 }} />
      <input name="reason" placeholder="Revize gerekçesi" required style={{ padding: '2px 6px', width: 130, fontSize: 12 }} />
      <button type="submit" disabled={pending} title="Onaylanmış tutarı değiştir — önceki onay geçersiz kılınır, yeniden onaya gider" style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Revize Et'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 11 }}>{state.success}</span> : null}
    </form>
  );
}

export { BONUS_TYPE_LABELS };
