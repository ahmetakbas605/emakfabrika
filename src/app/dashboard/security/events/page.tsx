import { requireFactoryAdmin } from '@/lib/dal';
import { listSecurityEvents } from '@/lib/security/events';
import { PageHeader, GlassPanel, RiskBadge, Badge } from '@/components/shell/ui';
import { ResolveEventButtons } from '@/components/security/admin-forms';

const STATUS_LABELS: Record<string, string> = { DETECTED: 'Tespit Edildi', INVESTIGATING: 'İnceleniyor', RESOLVED: 'Çözüldü', FALSE_POSITIVE: 'Yanlış Alarm' };

export default async function SecurityEventsPage() {
  const session = await requireFactoryAdmin();
  const events = await listSecurityEvents(session.companyId);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Risk Motoru" title="Güvenlik Olayları" description="Eşik-tabanlı risk kuralları (toplu export, tekrarlı başarısız giriş...) burada listelenir (madde 27-29)." />
      <GlassPanel>
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <RiskBadge level={e.riskLevel} />
                  <span className="text-xs font-mono" style={{ color: 'var(--aurora-text-dim)' }}>{e.eventType}</span>
                  <Badge tone={e.status === 'DETECTED' ? 'warn' : e.status === 'RESOLVED' ? 'ok' : 'neutral'}>{STATUS_LABELS[e.status] ?? e.status}</Badge>
                </div>
                <p className="text-sm">{e.description}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-faint)' }}>{new Date(e.createdAt).toLocaleString('tr-TR')}</p>
              </div>
              {e.status === 'DETECTED' || e.status === 'INVESTIGATING' ? <ResolveEventButtons eventId={e.id} /> : null}
            </div>
          ))}
          {events.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz güvenlik olayı yok.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}
