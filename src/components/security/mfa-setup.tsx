'use client';

import { useState, useActionState } from 'react';
import { beginMfaSetupAction, confirmMfaSetupAction, disableMfaAction, type FormState } from '@/actions/security-mfa';
import { AuroraButton, AuroraInput } from '@/components/shell/ui';

export function MfaSetupFlow({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [setup, setSetup] = useState<{ qrCodeDataUrl: string; secret: string; recoveryCodes: string[] } | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmState, confirmAction, confirmPending] = useActionState<FormState, FormData>(confirmMfaSetupAction, undefined);
  const [disableState, disableAction, disablePending] = useActionState<FormState, FormData>(disableMfaAction, undefined);

  async function handleBegin() {
    setStarting(true);
    const result = await beginMfaSetupAction();
    setStarting(false);
    if (result?.qrCodeDataUrl && result?.secret && result?.recoveryCodes) {
      setSetup({ qrCodeDataUrl: result.qrCodeDataUrl, secret: result.secret, recoveryCodes: result.recoveryCodes });
    }
  }

  if (mfaEnabled && !confirmState?.success) {
    return (
      <div className="glass-card p-5">
        <p className="text-sm mb-4">MFA şu anda <span style={{ color: 'var(--aurora-emerald)' }}>etkin</span>. Devre dışı bırakmak, hesabınızı yalnızca şifreyle korumaya döndürür.</p>
        <form action={disableAction}>
          <AuroraButton type="submit" variant="danger" disabled={disablePending}>{disablePending ? '...' : 'MFA\'yı Devre Dışı Bırak'}</AuroraButton>
        </form>
        {disableState?.success ? <p className="text-sm mt-3" style={{ color: 'var(--aurora-emerald)' }}>{disableState.success}</p> : null}
      </div>
    );
  }

  if (confirmState?.success) {
    return <div className="glass-card p-5"><p className="text-sm" style={{ color: 'var(--aurora-emerald)' }}>{confirmState.success} Sayfayı yenileyin.</p></div>;
  }

  if (!setup) {
    return (
      <div className="glass-card p-5">
        <p className="text-sm mb-4" style={{ color: 'var(--aurora-text-dim)' }}>MFA şu anda devre dışı. Google Authenticator, Authy veya benzeri bir uygulama ile kurulum yapabilirsiniz.</p>
        <AuroraButton onClick={handleBegin} disabled={starting}>{starting ? 'Hazırlanıyor...' : 'MFA Kurulumunu Başlat'}</AuroraButton>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <p className="text-sm mb-3" style={{ color: 'var(--aurora-text-dim)' }}>1. QR kodu authenticator uygulamanızla tarayın:</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrCodeDataUrl} alt="MFA QR kodu" width={180} height={180} className="rounded-lg border border-white/10" />
        <p className="text-xs mt-2 font-mono" style={{ color: 'var(--aurora-text-faint)' }}>Manuel giriş: {setup.secret}</p>
      </div>
      <div>
        <p className="text-sm mb-2" style={{ color: 'var(--aurora-text-dim)' }}>2. Kurtarma kodlarınızı GÜVENLİ bir yere kaydedin (her biri tek kullanımlıktır):</p>
        <div className="font-mono text-xs grid grid-cols-2 gap-1 p-3 rounded-lg bg-white/[0.03]">
          {setup.recoveryCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
      </div>
      <form action={confirmAction} className="flex items-end gap-2">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>3. Uygulamadaki 6 haneli kodu girin</label>
          <AuroraInput name="code" required maxLength={6} className="w-32" />
        </div>
        <AuroraButton type="submit" disabled={confirmPending}>{confirmPending ? '...' : 'Doğrula ve Etkinleştir'}</AuroraButton>
      </form>
      {confirmState?.error ? <p className="text-sm" style={{ color: 'var(--aurora-danger)' }}>{confirmState.error}</p> : null}
    </div>
  );
}
