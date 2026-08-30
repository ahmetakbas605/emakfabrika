'use client';

import { useActionState } from 'react';
import { createAccessZoneAction, createAccessGroupAction, addZoneToGroupAction, addGroupMemberAction, issueCardAction, setCardStatusAction, recordAccessAttemptAction, type FormState } from '@/actions/hr-access';

export function ZoneForm({ departmentId }: { departmentId: string }) {
  const action = createAccessZoneAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} placeholder="SUNUCU-ODA" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} placeholder="Sunucu Odası" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label><input name="description" style={{ padding: 6, width: 200 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bölge Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function GroupForm({ departmentId }: { departmentId: string }) {
  const action = createAccessGroupAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} placeholder="BT-YETKILI" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} placeholder="BT Yetkilileri" /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label><input name="description" style={{ padding: 6, width: 200 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Grup Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function AddZoneToGroupForm({ departmentId, groups, zones }: { departmentId: string; groups: { id: string; name: string }[]; zones: { id: string; name: string }[] }) {
  const action = addZoneToGroupAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Grup</label>
        <select name="groupId" required style={{ padding: 6, width: 180 }}><option value="">Seçiniz</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bölge</label>
        <select name="zoneId" required style={{ padding: 6, width: 180 }}><option value="">Seçiniz</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Bölgeyi Gruba Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function AddGroupMemberForm({ departmentId, groups, employees }: { departmentId: string; groups: { id: string; name: string }[]; employees: { id: string; firstName: string; lastName: string }[] }) {
  const action = addGroupMemberAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Grup</label>
        <select name="groupId" required style={{ padding: 6, width: 180 }}><option value="">Seçiniz</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}><option value="">Seçiniz</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Başlangıcı (ops.)</label><input name="validFrom" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Geçerlilik Bitişi (ops.)</label><input name="validUntil" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Çalışanı Gruba Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function IssueCardForm({ departmentId, employees }: { departmentId: string; employees: { id: string; firstName: string; lastName: string }[] }) {
  const action = issueCardAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Çalışan</label>
        <select name="employeeId" required style={{ padding: 6, width: 180 }}><option value="">Seçiniz</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kart Numarası</label><input name="cardNumber" required style={{ padding: 6, width: 150 }} placeholder="RFID-0001" /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kart Tanımla'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CardStatusButtons({ departmentId, cardId, currentStatus }: { departmentId: string; cardId: string; currentStatus: string }) {
  const action = setCardStatusAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const options = ['ACTIVE', 'LOST', 'REVOKED'].filter((s) => s !== currentStatus);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4 }}>
      <input type="hidden" name="cardId" value={cardId} />
      <select name="status" style={{ padding: 2, fontSize: 12 }}>
        {options.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Durumu Değiştir'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function RecordAccessAttemptForm({ departmentId, manualDevices, zones }: { departmentId: string; manualDevices: { id: string; name: string }[]; zones: { id: string; name: string }[] }) {
  const action = recordAccessAttemptAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Cihaz (Manuel)</label>
        <select name="deviceId" required style={{ padding: 6, width: 160 }}><option value="">Seçiniz</option>{manualDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bölge</label>
        <select name="zoneId" required style={{ padding: 6, width: 160 }}><option value="">Seçiniz</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kart Numarası</label><input name="cardNumber" required style={{ padding: 6, width: 150 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Kart Okut (Test)'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}
