'use client';

import { useActionState, useState } from 'react';
import { setScoringWeightsAction, submitTechnicalEvaluationAction, submitCommercialEvaluationAction, type FormState } from '@/actions/procurement-evaluation';

const COMPLIANCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'COMPLIANT', label: 'Uygun' },
  { value: 'PARTIALLY_COMPLIANT', label: 'Kısmen Uygun' },
  { value: 'ALTERNATIVE_ACCEPTED', label: 'Alternatif Kabul' },
  { value: 'NON_COMPLIANT', label: 'Uygun Değil' },
  { value: 'REJECTED', label: 'Reddedildi' }
];

export function ScoringWeightsForm({ weights }: { weights: { priceWeight: string; technicalWeight: string; deliveryWeight: string; commercialWeight: string } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setScoringWeightsAction, undefined);
  const [values, setValues] = useState(weights);
  const total = [values.priceWeight, values.technicalWeight, values.deliveryWeight, values.commercialWeight].reduce((acc, v) => acc + (Number(v) || 0), 0);

  return (
    <form action={formAction} style={{ border: '1px solid #ddd', padding: 14, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <h4 style={{ fontSize: 13, margin: 0 }}>Skorlama Ağırlıkları</h4>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Fiyat %
          <input name="priceWeight" type="number" step="0.01" value={values.priceWeight} onChange={(e) => setValues((v) => ({ ...v, priceWeight: e.target.value }))} style={{ padding: 5, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Teknik %
          <input name="technicalWeight" type="number" step="0.01" value={values.technicalWeight} onChange={(e) => setValues((v) => ({ ...v, technicalWeight: e.target.value }))} style={{ padding: 5, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Teslimat %
          <input name="deliveryWeight" type="number" step="0.01" value={values.deliveryWeight} onChange={(e) => setValues((v) => ({ ...v, deliveryWeight: e.target.value }))} style={{ padding: 5, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Ticari %
          <input name="commercialWeight" type="number" step="0.01" value={values.commercialWeight} onChange={(e) => setValues((v) => ({ ...v, commercialWeight: e.target.value }))} style={{ padding: 5, width: 80 }} />
        </label>
      </div>
      <p style={{ fontSize: 12, color: total === 100 ? '#080' : '#b00', margin: 0 }}>Toplam: %{total}{total !== 100 ? ' (100 olmalı)' : ''}</p>
      <div>
        <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 12, marginLeft: 8 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: '#080', fontSize: 12, marginLeft: 8 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function TechnicalEvaluationForm({ rfqId, quotationLineId, initial }: { rfqId: string; quotationLineId: string; initial?: { complianceStatus: string; reason: string | null } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitTechnicalEvaluationAction, undefined);
  const [status, setStatus] = useState(initial?.complianceStatus ?? '');
  const needsReason = status === 'NON_COMPLIANT' || status === 'REJECTED';

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="quotationLineId" value={quotationLineId} />
      <select name="complianceStatus" value={status} onChange={(e) => setStatus(e.target.value)} required style={{ padding: 4, fontSize: 12 }}>
        <option value="">Teknik durum seçin</option>
        {COMPLIANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {needsReason ? <input name="reason" defaultValue={initial?.reason ?? ''} placeholder="Gerekçe (zorunlu)" style={{ padding: 4, fontSize: 12 }} /> : null}
      <div>
        <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
      </div>
    </form>
  );
}

export function CommercialEvaluationForm({ rfqId, quotationId, initial }: { rfqId: string; quotationId: string; initial?: { score: number; notes: string | null } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitCommercialEvaluationAction, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <input name="score" type="number" min={0} max={100} step="0.01" defaultValue={initial?.score ?? ''} placeholder="Puan (0-100)" required style={{ padding: 4, fontSize: 12, width: 90 }} />
      <input name="notes" defaultValue={initial?.notes ?? ''} placeholder="Not" style={{ padding: 4, fontSize: 12 }} />
      <div>
        <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>{pending ? '...' : 'Kaydet'}</button>
        {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 6 }}>{state.error}</span> : null}
      </div>
    </form>
  );
}
