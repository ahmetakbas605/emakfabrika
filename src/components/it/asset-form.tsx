'use client';

import { useActionState } from 'react';
import { createAssetAction, type FormState } from '@/actions/it/assets';

export function AssetForm({ departmentId, assetTypes }: { departmentId: string; assetTypes: { code: string; name: string }[] }) {
  const action = createAssetAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Varlık Etiketi</label>
        <input name="assetTag" required style={{ padding: 6, width: 110 }} placeholder="PC-000234" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tür</label>
        <select name="assetTypeCode" required style={{ padding: 6, minWidth: 150 }}>
          <option value="">Seçin...</option>
          {assetTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ad</label>
        <input name="name" required style={{ padding: 6, width: 160 }} placeholder="Muhasebe Masaüstü 1" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Üretici</label>
        <input name="manufacturer" style={{ padding: 6, width: 110 }} placeholder="Dell" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Model</label>
        <input name="model" style={{ padding: 6, width: 110 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Seri No</label>
        <input name="serialNumber" style={{ padding: 6, width: 130 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Alış Tarihi</label>
        <input name="purchaseDate" type="date" style={{ padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Maliyet</label>
        <input name="purchaseCost" type="number" step="any" min={0} style={{ padding: 6, width: 100 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'Varlık Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
