import { requireFactoryAdmin } from '@/lib/dal';
import { listBreakGlassAccess } from '@/lib/security/breakglass';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { BreakGlassForm, ApproveBreakGlassForm, RevokeBreakGlassButton } from '@/components/security/admin-forms';

const STATUS_LABELS: Record<string, string> = { PENDING: 'Bekliyor', ACTIVE: 'Aktif', EXPIRED: 'Süresi Doldu', REVOKED: 'İptal Edildi' };
const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'> = { PENDING: 'warn', ACTIVE: 'danger', EXPIRED: 'neutral', REVOKED: 'neutral' };

function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR');
}

export default async function BreakGlassPage() {
  const session = await requireFactoryAdmin();
  const requests = await listBreakGlassAccess(session.companyId);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Break-Glass" title="Acil Durum Erişimi" description="isFactoryAdmin zaten koşulsuz tam yetkili — bu, normal iş akışı dışında gerekçeli bir erişimi LOGLANABİLİR kılar (madde 38-39). Gerçek erişim engelleme/zorlama mekanizması bu fazın kapsamı dışında." />

      <GlassPanel className="mb-5"><BreakGlassForm /></GlassPanel>

      <GlassPanel>
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="py-3 border-b border-white/[0.05] last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <span>{r.reason}</span>
                  {r.ticketReference ? <span className="ml-2 text-xs font-mono" style={{ color: 'var(--aurora-text-dim)' }}>#{r.ticketReference}</span> : null}
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-dim)' }}>Kapsam: {r.scope || '—'} · Başlangıç: {formatDateTime(r.startAt)} · Bitiş: {formatDateTime(r.endAt)}</p>
              <div className="mt-2">
                {r.status === 'PENDING' ? <ApproveBreakGlassForm accessId={r.id} /> : null}
                {r.status === 'ACTIVE' ? <RevokeBreakGlassButton accessId={r.id} /> : null}
              </div>
            </div>
          ))}
          {requests.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz talep yok.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}
