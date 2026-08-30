'use client';

import { useActionState } from 'react';
import { createOpportunityAction, setOpportunityStageAction, type FormState } from '@/actions/sales-opportunities';

export function CreateOpportunityForm({ parties }: { parties: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createOpportunityAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Cari</label>
        <select name="partyId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Fırsat Adı</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tahmini Değer</label><input name="estimatedValue" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label><input name="currencyCode" defaultValue="TRY" style={{ padding: 6, width: 60 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Beklenen Kapanış</label><input name="expectedCloseDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Fırsat Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

const STAGE_LABELS: Record<string, string> = { NEW: 'Yeni', QUALIFICATION: 'Kalifikasyon', PROPOSAL: 'Teklif', NEGOTIATION: 'Pazarlık', WON: 'Kazanıldı', LOST: 'Kaybedildi' };

export function OpportunityStageButtons({ opportunityId, currentStage }: { opportunityId: string; currentStage: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setOpportunityStageAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <select name="stage" defaultValue={currentStage} style={{ padding: '2px 4px', fontSize: 12 }}>
        {Object.entries(STAGE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <input name="lostReason" placeholder="Kayıp gerekçesi (LOST için)" style={{ padding: '2px 4px', fontSize: 12, width: 140 }} />
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
