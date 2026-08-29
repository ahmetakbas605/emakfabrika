'use client';

import { useActionState } from 'react';
import { createChecklistTemplateAction, type FormState } from '@/actions/it/field-service';

export function ChecklistTemplateForm({ departmentId }: { departmentId: string }) {
  const action = createChecklistTemplateAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #ddd', padding: 12, borderRadius: 6, maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label>
          <input name="code" required placeholder="SERVER_MONTHLY_MAINTENANCE" style={{ padding: 6, width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label>
          <input name="name" required style={{ padding: 6, width: '100%' }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Maddeler (her satır bir madde)</label>
        <textarea name="itemsText" required rows={4} placeholder={'Filtre kontrolü\nGüç kaynağı testi\nYedekleme kontrolü'} style={{ padding: 6, width: '100%' }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? '...' : 'Şablon Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
