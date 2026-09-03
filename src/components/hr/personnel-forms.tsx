'use client';

import { useActionState } from 'react';
import { addEmployeeContactAction, addEmployeeAddressAction, addEmployeeEmergencyContactAction, terminateEmployeeAction, linkEmployeeToUserAction, type FormState } from '@/actions/hr-employees';

const CONTACT_TYPE_LABELS: Record<string, string> = { PHONE_MOBILE: 'Cep Telefonu', PHONE_HOME: 'Ev Telefonu', PHONE_WORK: 'İş Telefonu', EMAIL_PERSONAL: 'Kişisel E-posta', EMAIL_WORK: 'İş E-postası', OTHER: 'Diğer' };

export function ContactForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = addEmployeeContactAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <select name="contactType" required style={{ padding: 6, width: 150 }}>
        {Object.entries(CONTACT_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <input name="value" required placeholder="0555 000 00 00" style={{ padding: 6, width: 180 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}

export function AddressForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = addEmployeeAddressAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <select name="addressType" style={{ padding: 6, width: 110 }}>
        <option value="HOME">Ev</option>
        <option value="WORK">İş</option>
        <option value="OTHER">Diğer</option>
      </select>
      <input name="line" required placeholder="Adres" style={{ padding: 6, width: 220 }} />
      <input name="city" placeholder="İl" style={{ padding: 6, width: 100 }} />
      <input name="district" placeholder="İlçe" style={{ padding: 6, width: 100 }} />
      <input name="postalCode" placeholder="Posta Kodu" style={{ padding: 6, width: 100 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}

export function EmergencyContactForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = addEmployeeEmergencyContactAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input name="fullName" required placeholder="Ad Soyad" style={{ padding: 6, width: 160 }} />
      <input name="relationship" placeholder="Yakınlık (Eş, Anne, ...)" style={{ padding: 6, width: 150 }} />
      <input name="phone" required placeholder="0555 000 00 00" style={{ padding: 6, width: 150 }} />
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Ekle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}

export function TerminateForm({ departmentId, employeeId }: { departmentId: string; employeeId: string }) {
  const action = terminateEmployeeAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İşten Ayrılış Tarihi</label>
        <input name="terminationDate" type="date" required style={{ padding: 6 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer', color: 'var(--dim-danger)' }}>{pending ? '...' : 'İşten Ayrıldı Olarak İşaretle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}

export function LinkUserForm({ departmentId, employeeId, users }: { departmentId: string; employeeId: string; users: { id: string; fullName: string; email: string }[] }) {
  const action = linkEmployeeToUserAction.bind(null, departmentId, employeeId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <select name="userId" required style={{ padding: 6, width: 220 }}>
        <option value="">Kullanıcı seçin</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
      </select>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Bağla'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, width: '100%' }}>{state.success}</span> : null}
    </form>
  );
}
