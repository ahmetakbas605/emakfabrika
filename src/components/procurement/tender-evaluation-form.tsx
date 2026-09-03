'use client';

import { useActionState, useState } from 'react';
import { submitTenderTechnicalEvaluationAction, submitTenderCommercialEvaluationAction, type FormState } from '@/actions/procurement-tender';

const COMPLIANCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'COMPLIANT', label: 'Uygun' },
  { value: 'PARTIALLY_COMPLIANT', label: 'Kısmen Uygun' },
  { value: 'ALTERNATIVE_ACCEPTED', label: 'Alternatif Kabul' },
  { value: 'NON_COMPLIANT', label: 'Uygun Değil' },
  { value: 'REJECTED', label: 'Reddedildi' }
];

// evaluation-form.tsx:TechnicalEvaluationForm/CommercialEvaluationForm İLE
// BİREBİR AYNI (Faz 3) — yalnızca rfqId/quotationLineId/quotationId yerine
// tenderId/tenderBidLineId/tenderBidId. Ayrı bileşen (küçük, gerekçeli tekrar).
export function TenderTechnicalEvaluationForm({ tenderId, tenderBidLineId, initial }: { tenderId: string; tenderBidLineId: string; initial?: { complianceStatus: string; reason: string | null } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitTenderTechnicalEvaluationAction, undefined);
  const [status, setStatus] = useState(initial?.complianceStatus ?? '');
  const needsReason = status === 'NON_COMPLIANT' || status === 'REJECTED';

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <input type="hidden" name="tenderBidLineId" value={tenderBidLineId} />
      <select name="complianceStatus" value={status} onChange={(e) => setStatus(e.target.value)} required style={{ padding: 4, fontSize: 12 }}>
        <option value="">Teknik durum seçin</option>
        {COMPLIANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {needsReason ? <input name="reason" defaultValue={initial?.reason ?? ''} placeholder="Gerekçe (zorunlu)" style={{ padding: 4, fontSize: 12 }} /> : null}
      <div>
        <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
      </div>
    </form>
  );
}

export function TenderCommercialEvaluationForm({ tenderId, tenderBidId, initial }: { tenderId: string; tenderBidId: string; initial?: { score: number; notes: string | null } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitTenderCommercialEvaluationAction, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <input type="hidden" name="tenderBidId" value={tenderBidId} />
      <input name="score" type="number" min={0} max={100} step="0.01" defaultValue={initial?.score ?? ''} placeholder="Puan (0-100)" required style={{ padding: 4, fontSize: 12, width: 90 }} />
      <input name="notes" defaultValue={initial?.notes ?? ''} placeholder="Not" style={{ padding: 4, fontSize: 12 }} />
      <div>
        <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
      </div>
    </form>
  );
}
