'use client';

import { useActionState, useState } from 'react';
import { actOnStepAction, type FormState } from '@/actions/workflow';

export function ApprovalActionForm({ stepId, users, documentType, warehouses }: { stepId: string; users: { id: string; fullName: string }[]; documentType?: string; warehouses?: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(actOnStepAction, undefined);
  const [showDelegate, setShowDelegate] = useState(false);
  const [showComment, setShowComment] = useState<null | 'REJECT' | 'REQUEST_CHANGES'>(null);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="hidden" name="stepId" value={stepId} />
      {documentType === 'SALES_ORDER' && warehouses && warehouses.length > 0 ? (
        <div>
          <label style={{ display: 'block', fontSize: 10, color: '#666' }}>Onaylanırsa stok rezerve edilecek depo (opsiyonel)</label>
          <select name="warehouseId" style={{ padding: 4, fontSize: 11 }}>
            <option value="">— rezervasyon yapma —</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" name="decision" value="APPROVE" disabled={pending} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Onayla</button>
        <button type="button" onClick={() => setShowComment('REJECT')} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Reddet</button>
        <button type="button" onClick={() => setShowComment('REQUEST_CHANGES')} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Değişiklik İste</button>
        <button type="button" onClick={() => setShowDelegate((v) => !v)} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Devret</button>
      </div>
      {showComment ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="hidden" name="decision" value={showComment} />
          <input name="comment" required placeholder="Gerekçe (zorunlu)" style={{ padding: 5, fontSize: 12, width: 220 }} />
          <button type="submit" disabled={pending} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Gönder</button>
        </div>
      ) : null}
      {showDelegate ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="hidden" name="decision" value="DELEGATE" />
          <select name="delegateToUserId" required style={{ padding: 5, fontSize: 12 }}>
            <option value="">Kime devredilsin?</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <button type="submit" disabled={pending} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Devret</button>
        </div>
      ) : null}
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}
