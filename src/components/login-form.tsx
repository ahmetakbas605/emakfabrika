'use client';

import { useActionState, useState, useEffect } from 'react';
import { login, verifyMfaAndLogin } from '@/actions/auth';

// Core Security Faz 5 — login() MFA etkin bir kullanıcı için oturum AÇMADAN
// {mfaRequired, mfaPendingToken} döner; bu bileşen o durumda ikinci adıma
// (TOTP/recovery kodu) geçer. verifyMfaAndLogin AYNI FormState şeklini
// paylaştığı için tek useActionState çifti yeterli — adım geçişi state'teki
// mfaRequired bayrağıyla yönetiliyor.
export function LoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(login, undefined);
  const [mfaState, mfaAction, mfaPending] = useActionState(verifyMfaAndLogin, undefined);
  const [step, setStep] = useState<'CREDENTIALS' | 'MFA'>('CREDENTIALS');
  const [pendingToken, setPendingToken] = useState('');

  useEffect(() => {
    if (loginState?.mfaRequired && loginState.mfaPendingToken) {
      setPendingToken(loginState.mfaPendingToken);
      setStep('MFA');
    }
  }, [loginState]);

  useEffect(() => {
    if (mfaState?.mfaRequired && mfaState.mfaPendingToken) {
      setPendingToken(mfaState.mfaPendingToken);
    }
  }, [mfaState]);

  if (step === 'MFA') {
    return (
      <form action={mfaAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="hidden" name="mfaPendingToken" value={pendingToken} />
        <p style={{ fontSize: 13, color: '#555' }}>
          Hesabınızda iki adımlı doğrulama etkin. Kimlik doğrulama uygulamanızdaki 6 haneli kodu veya bir kurtarma kodunu girin.
        </p>
        <label>
          Doğrulama Kodu
          <input name="code" autoFocus required autoComplete="one-time-code" style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
        </label>
        {mfaState?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{mfaState.error}</p> : null}
        <button type="submit" disabled={mfaPending} style={{ padding: 10, cursor: 'pointer' }}>
          {mfaPending ? 'Doğrulanıyor...' : 'Doğrula ve Giriş Yap'}
        </button>
        <button
          type="button"
          onClick={() => { setStep('CREDENTIALS'); setPendingToken(''); }}
          style={{ padding: 8, background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}
        >
          ← E-posta/şifreye dön
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label>
        E-posta
        <input name="email" type="email" required style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
      </label>
      <label>
        Şifre
        <input name="password" type="password" required style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
      </label>
      {loginState?.error ? <p style={{ color: '#b00', fontSize: 13 }}>{loginState.error}</p> : null}
      <button type="submit" disabled={loginPending} style={{ padding: 10, cursor: 'pointer' }}>
        {loginPending ? 'Giriş yapılıyor...' : 'Giriş Yap'}
      </button>
    </form>
  );
}
