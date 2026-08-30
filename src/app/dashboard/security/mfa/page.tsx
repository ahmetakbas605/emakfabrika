import { requireSession } from '@/lib/dal';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PageHeader } from '@/components/shell/ui';
import { MfaSetupFlow } from '@/components/security/mfa-setup';

export default async function MfaPage() {
  const session = await requireSession();
  const [user] = await db.select({ mfaEnabled: users.mfaEnabled, mfaEnabledAt: users.mfaEnabledAt }).from(users).where(eq(users.id, session.id)).limit(1);

  return (
    <div>
      <PageHeader eyebrow="Core Security · MFA" title="İki Adımlı Doğrulama (MFA)" description="RFC 6238 TOTP — Google Authenticator / Authy uyumlu. Kurtarma kodları tek kullanımlıktır." />
      <MfaSetupFlow mfaEnabled={user?.mfaEnabled ?? false} />
    </div>
  );
}
