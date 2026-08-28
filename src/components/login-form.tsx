'use client';

import { useActionState } from 'react';
import { login } from '@/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label>
        E-posta
        <input name="email" type="email" required style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
      </label>
      <label>
        Şifre
        <input name="password" type="password" required style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
      </label>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{state.error}</p> : null}
      <button type="submit" disabled={pending} style={{ padding: 10, cursor: 'pointer' }}>
        {pending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
      </button>
    </form>
  );
}
