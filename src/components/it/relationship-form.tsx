'use client';

import { useActionState } from 'react';
import { createRelationshipAction, type FormState } from '@/actions/it/cmdb';

const RELATIONSHIP_TYPES = [
  'DEPENDS_ON', 'RUNS_ON', 'CONNECTED_TO', 'HOSTED_ON', 'LOCATED_IN', 'OWNED_BY',
  'USED_BY', 'BACKED_UP_BY', 'MONITORED_BY', 'PROTECTED_BY', 'LICENSED_BY',
  'SUPPORTED_BY', 'CONTRACTED_BY', 'PARENT_OF', 'CHILD_OF'
];

export function RelationshipForm({ departmentId, cis }: { departmentId: string; cis: { id: string; ciKey: string; name: string }[] }) {
  const action = createRelationshipAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kaynak CI</label>
        <select name="sourceCiId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {cis.map((c) => <option key={c.id} value={c.id}>{c.ciKey} — {c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İlişki</label>
        <select name="relationshipType" required style={{ padding: 6 }}>
          {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Hedef CI</label>
        <select name="targetCiId" required style={{ padding: 6, minWidth: 160 }}>
          <option value="">Seçin...</option>
          {cis.map((c) => <option key={c.id} value={c.id}>{c.ciKey} — {c.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Ekleniyor...' : 'İlişki Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
