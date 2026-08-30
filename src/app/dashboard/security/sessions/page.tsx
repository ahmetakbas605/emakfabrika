import { requireSession } from '@/lib/dal';
import { listActiveSessions, listCompanyActiveSessions } from '@/lib/security/sessions';
import { readSessionCookie } from '@/lib/session';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { RevokeMySessionButton, RevokeAllOtherSessionsButton, AdminRevokeSessionButton } from '@/components/security/session-forms';

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('tr-TR');
}

export default async function SessionsPage() {
  const session = await requireSession();
  const pointer = await readSessionCookie();
  const [mySessions, companySessions] = await Promise.all([
    listActiveSessions(session.companyId, session.id),
    session.isFactoryAdmin ? listCompanyActiveSessions(session.companyId) : Promise.resolve([])
  ]);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Oturumlar" title="Oturum ve Cihaz Yönetimi" description="Çoklu eşzamanlı oturum desteği — kayıp bir cihazın oturumunu buradan tek başına sonlandırabilirsiniz (madde 15-16)." />

      <GlassPanel title="Benim Oturumlarım" className="mb-5">
        <div className="space-y-2">
          {mySessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.05] last:border-0">
              <div>
                <div>{s.deviceLabel || s.userAgent.slice(0, 60) || 'Bilinmeyen cihaz'}{s.id === pointer?.sessionId ? <Badge tone="accent">şu anki oturum</Badge> : null}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-dim)' }}>IP: {s.ip || '—'} · Son aktivite: {formatDateTime(s.lastActivityAt)}</div>
              </div>
              {s.id !== pointer?.sessionId ? <RevokeMySessionButton sessionId={s.id} /> : null}
            </div>
          ))}
          {mySessions.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Aktif oturum yok.</p> : null}
        </div>
        {mySessions.length > 1 ? <div className="mt-4"><RevokeAllOtherSessionsButton /></div> : null}
      </GlassPanel>

      {session.isFactoryAdmin ? (
        <GlassPanel title="Şirket Geneli Aktif Oturumlar">
          <div className="space-y-2">
            {companySessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.05] last:border-0">
                <div>
                  <div>{s.userName}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-dim)' }}>IP: {s.ip || '—'} · Son aktivite: {formatDateTime(s.lastActivityAt)}</div>
                </div>
                <AdminRevokeSessionButton sessionId={s.id} userId={s.userId} />
              </div>
            ))}
            {companySessions.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Aktif oturum yok.</p> : null}
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
