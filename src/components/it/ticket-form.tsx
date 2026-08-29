'use client';

import { useActionState, useState } from 'react';
import { createTicketAction, type FormState } from '@/actions/it/tickets';
import { suggestCategoryAndPriority } from '@/lib/it/ticket-suggest';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export function TicketForm({ departmentId, assets }: { departmentId: string; assets: { id: string; assetTag: string; name: string }[] }) {
  const action = createTicketAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [suggested, setSuggested] = useState(false);

  // SERVICE-DESK.md §3 — ÖNERİ, otomatik uygulanmaz; kullanıcı odağı
  // başlık/açıklamadan ayırınca bir kez ön-doldurur, sonrasında serbestçe
  // değiştirilebilir.
  function applySuggestion() {
    const s = suggestCategoryAndPriority(title, description);
    if (s && !suggested) {
      setCategory(s.category);
      setPriority(s.priority);
      setSuggested(true);
    }
  }

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #ddd', padding: 12, borderRadius: 6, maxWidth: 480 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlık</label>
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={applySuggestion} required style={{ padding: 6, width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label>
        <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={applySuggestion} rows={3} style={{ padding: 6, width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kategori {suggested ? '(önerildi)' : ''}</label>
          <input name="category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 6, width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Öncelik {suggested ? '(önerildi)' : ''}</label>
          <select name="priority" value={priority} onChange={(e) => setPriority(e.target.value)} style={{ padding: 6 }}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <label style={{ fontSize: 12, color: '#666', display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" name="ticketType" value="FIELD_SERVICE" /> Saha işi (teknisyen fiziksel olarak gidecek)
      </label>
      {assets.length > 0 ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>İlgili Varlık (opsiyonel)</label>
          <select name="relatedAssetId" style={{ padding: 6, width: '100%' }}>
            <option value="">Seçilmedi</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </select>
        </div>
      ) : null}
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>{pending ? 'Oluşturuluyor...' : 'Ticket Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13 }}>{state.success}</p> : null}
    </form>
  );
}
