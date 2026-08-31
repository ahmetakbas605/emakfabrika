'use client';

import { useActionState } from 'react';
import { createEnvPermitAction, recordEmissionAction, recordWasteAction, type FormState } from '@/actions/environment';

export function CreateEnvPermitForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEnvPermitAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="permitType" required style={{ padding: 6 }}>
          <option value="EMISSION">Emisyon</option>
          <option value="WASTE">Atık</option>
          <option value="WATER">Su</option>
          <option value="AIR">Hava</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Veren Kurum (ops.)</label><input name="issuingAuthority" style={{ padding: 6, width: 160 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Düzenleme (ops.)</label><input name="issueDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Son Geçerlilik (ops.)</label><input name="expiryDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İzin Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function RecordEmissionForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordEmissionAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="recordDate" type="date" required style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="emissionType" required style={{ padding: 6 }}>
          <option value="CO2">CO2</option>
          <option value="NOX">NOx</option>
          <option value="SOX">SOx</option>
          <option value="PARTICULATE">Partikül</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Miktar</label><input name="quantity" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim</label><input name="unit" placeholder="kg, ton..." required style={{ padding: 6, width: 80 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kaynak (ops.)</label><input name="source" style={{ padding: 6, width: 140 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Emisyon Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function RecordWasteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordWasteAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label><input name="recordDate" type="date" required style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tip</label>
        <select name="wasteType" required style={{ padding: 6 }}>
          <option value="HAZARDOUS">Tehlikeli</option>
          <option value="NON_HAZARDOUS">Tehlikesiz</option>
          <option value="RECYCLABLE">Geri Dönüştürülebilir</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Miktar</label><input name="quantity" type="number" step="0.01" required style={{ padding: 6, width: 90 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Birim</label><input name="unit" placeholder="kg, ton..." required style={{ padding: 6, width: 80 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bertaraf Yöntemi</label>
        <select name="disposalMethod" required style={{ padding: 6 }}>
          <option value="LANDFILL">Depolama</option>
          <option value="INCINERATION">Yakma</option>
          <option value="RECYCLING">Geri Dönüşüm</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bertaraf Firması (ops.)</label><input name="disposalCompany" style={{ padding: 6, width: 140 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Atık Kaydet'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
