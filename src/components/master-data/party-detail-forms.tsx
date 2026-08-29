'use client';

import { useActionState } from 'react';
import { addPartyAddressAction, addPartyContactAction, type FormState } from '@/actions/master-data';

export function PartyAddressForm({ partyId }: { partyId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPartyAddressAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="partyId" value={partyId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="addressType" style={{ padding: 6 }}>
          <option value="OTHER">Diğer</option>
          <option value="BILLING">Fatura</option>
          <option value="SHIPPING">Sevkiyat</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Etiket</label>
        <input name="label" style={{ padding: 6, width: 140 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Adres</label>
        <input name="addressLine" style={{ padding: 6, width: 260 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İl</label>
        <input name="city" style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İlçe</label>
        <input name="district" style={{ padding: 6, width: 120 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Adres Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}

export function PartyContactForm({ partyId }: { partyId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPartyContactAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="partyId" value={partyId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad Soyad</label>
        <input name="fullName" required style={{ padding: 6, width: 180 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Unvan</label>
        <input name="title" style={{ padding: 6, width: 140 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>E-posta</label>
        <input name="email" type="email" style={{ padding: 6, width: 200 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Telefon</label>
        <input name="phone" style={{ padding: 6, width: 140 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Yetkili Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
