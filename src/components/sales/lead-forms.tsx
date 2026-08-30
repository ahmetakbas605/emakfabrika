'use client';

import { useActionState } from 'react';
import { createLeadAction, updateLeadStatusAction, convertLeadAction, type FormState } from '@/actions/sales-leads';

export function CreateLeadForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLeadAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>İletişim Adı</label><input name="contactName" required style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Şirket</label><input name="companyName" style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>E-posta</label><input name="email" type="email" style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Telefon</label><input name="phone" style={{ padding: 6, width: 130 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kaynak</label><input name="source" placeholder="Web, Referans, Fuar..." style={{ padding: 6, width: 130 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

const LEAD_STATUS_LABELS: Record<string, string> = { NEW: 'Yeni', CONTACTED: 'İletişime Geçildi', QUALIFIED: 'Kalifiye', DISQUALIFIED: 'Kalifiye Değil' };

export function LeadStatusButtons({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateLeadStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="leadId" value={leadId} />
      <select name="status" defaultValue={currentStatus} style={{ padding: '2px 4px', fontSize: 12 }}>
        {Object.entries(LEAD_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function ConvertLeadForm({ leadId, parties }: { leadId: string; parties: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(convertLeadAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 10, borderRadius: 4, marginTop: 6 }}>
      <input type="hidden" name="leadId" value={leadId} />
      <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Fırsat Adı</label><input name="opportunityName" required style={{ padding: 5, width: 150 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Tahmini Değer</label><input name="estimatedValue" type="number" step="0.01" style={{ padding: 5, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Para Birimi</label><input name="currencyCode" defaultValue="TRY" style={{ padding: 5, width: 60 }} /></div>
      <div><label style={{ display: 'block', fontSize: 11, color: '#666' }}>Beklenen Kapanış</label><input name="expectedCloseDate" type="date" style={{ padding: 5 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 11, color: '#666' }}>Mevcut Cariye Eşleştir (opsiyonel)</label>
        <select name="existingPartyId" style={{ padding: 5, minWidth: 140 }}>
          <option value="">— Yeni cari oluştur —</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Fırsata Dönüştür'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: '#080', fontSize: 11, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
