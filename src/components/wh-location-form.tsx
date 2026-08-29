'use client';

import { useActionState } from 'react';
import { createWhLocationAction, type FormState } from '@/actions/warehouse';

export function WhLocationForm({ departmentId, warehouseId, locations }: { departmentId: string; warehouseId: string; locations: { id: string; code: string }[] }) {
  const action = createWhLocationAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="locationType" style={{ padding: 6 }}>
          <option value="ZONE">Bölge</option>
          <option value="AISLE">Koridor</option>
          <option value="RACK">Raf</option>
          <option value="SHELF">Göz</option>
          <option value="BIN">Bin</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label>
        <input name="code" required style={{ padding: 6, width: 100 }} placeholder="A-01" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
        <input name="name" style={{ padding: 6, width: 140 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üst Konum</label>
        <select name="parentLocationId" style={{ padding: 6 }}>
          <option value="">— (kök seviye)</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Konum Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
