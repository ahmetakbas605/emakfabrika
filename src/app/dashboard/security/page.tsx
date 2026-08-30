import { requireFactoryAdmin } from '@/lib/dal';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { listAuditLogs } from '@/lib/security/audit';
import { listSecurityEvents } from '@/lib/security/events';
import { listActiveSessions, listCompanyActiveSessions } from '@/lib/security/sessions';
import { listDataSubjectRequests } from '@/lib/security/dsr';
import { listActiveLegalHolds } from '@/lib/security/retention';
import { PageHeader, GlassPanel, RiskBadge, Badge } from '@/components/shell/ui';
import { StatCard } from '@/components/shell/StatCard';
import Link from 'next/link';

export default async function SecurityDashboardPage() {
  const session = await requireFactoryAdmin();

  const [auditToday, events, activeSessions, dsrRequests, legalHolds, mfaStats] = await Promise.all([
    listAuditLogs(session.companyId, { from: new Date(new Date().setHours(0, 0, 0, 0)) }),
    listSecurityEvents(session.companyId, 'DETECTED'),
    listCompanyActiveSessions(session.companyId),
    listDataSubjectRequests(session.companyId),
    listActiveLegalHolds(session.companyId),
    db.select({ id: users.id, mfaEnabled: users.mfaEnabled }).from(users).where(eq(users.companyId, session.companyId))
  ]);

  const mfaAdoption = mfaStats.length > 0 ? Math.round((mfaStats.filter((u) => u.mfaEnabled).length / mfaStats.length) * 100) : 0;
  const openDsr = dsrRequests.filter((r) => r.status === 'SUBMITTED' || r.status === 'DRAFT').length;
  const recentAudit = auditToday.slice(0, 8);
  const criticalEvents = events.filter((e) => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH');

  return (
    <div>
      <PageHeader eyebrow="Core Security Platform" title="Güvenlik Paneli" description="KVKK + Güvenlik + Audit mimarisi — merkezi denetim, izin, saklama ve olay yönetimi." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bugünkü Audit Kaydı" value={auditToday.length} icon="scroll" accent="cyan" delay={0} />
        <StatCard label="Açık Güvenlik Olayı" value={events.length} icon="alert" accent={events.length > 0 ? 'danger' : 'emerald'} delay={0.05} />
        <StatCard label="Aktif Web Oturumu" value={activeSessions.length} icon="phone" accent="violet" delay={0.1} />
        <StatCard label="MFA Kapsamı" value={mfaAdoption} suffix="%" icon="key" accent={mfaAdoption > 50 ? 'emerald' : 'warn'} delay={0.15} />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <GlassPanel title="Son Audit Kayıtları" action={<Link href="/dashboard/security/audit" className="text-xs" style={{ color: 'var(--aurora-cyan)' }}>Tümü →</Link>}>
          <div className="space-y-2">
            {recentAudit.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/[0.05] last:border-0">
                <div>
                  <span className="font-mono text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{a.action}</span>
                  <span className="ml-2">{a.entity}</span>
                </div>
                <RiskBadge level={a.riskLevel} />
              </div>
            ))}
            {recentAudit.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Bugün henüz kayıt yok.</p> : null}
          </div>
        </GlassPanel>

        <GlassPanel title="Açık Güvenlik Olayları" action={<Link href="/dashboard/security/events" className="text-xs" style={{ color: 'var(--aurora-cyan)' }}>Tümü →</Link>}>
          <div className="space-y-2">
            {criticalEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/[0.05] last:border-0">
                <span className="truncate pr-2">{e.description}</span>
                <RiskBadge level={e.riskLevel} />
              </div>
            ))}
            {criticalEvents.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Kritik/yüksek riskli açık olay yok.</p> : null}
          </div>
        </GlassPanel>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <GlassPanel title="KVKK Talepleri">
          <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{openDsr}</div>
          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-dim)' }}>açık talep</p>
          <Link href="/dashboard/security/requests" className="text-xs" style={{ color: 'var(--aurora-cyan)' }}>Talepleri Yönet →</Link>
        </GlassPanel>
        <GlassPanel title="Aktif Legal Hold">
          <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{legalHolds.length}</div>
          <p className="text-xs mb-3" style={{ color: 'var(--aurora-text-dim)' }}>silme engelli kayıt</p>
          <Link href="/dashboard/security/retention" className="text-xs" style={{ color: 'var(--aurora-cyan)' }}>Saklama Politikaları →</Link>
        </GlassPanel>
        <GlassPanel title="Hızlı Erişim">
          <div className="flex flex-col gap-1.5 text-sm">
            <Link href="/dashboard/security/mfa" style={{ color: 'var(--aurora-text-dim)' }}>MFA Kurulumu</Link>
            <Link href="/dashboard/security/sessions" style={{ color: 'var(--aurora-text-dim)' }}>Oturum Yönetimi</Link>
            <Link href="/dashboard/security/break-glass" style={{ color: 'var(--aurora-text-dim)' }}>Break-Glass Erişim</Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
