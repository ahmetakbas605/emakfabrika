import { requireFactoryAdmin } from '@/lib/dal';
import { listDataSubjectRequests } from '@/lib/security/dsr';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { CreateDsrForm, SubmitDsrButton, ResolveDsrForm } from '@/components/security/admin-forms';

const TYPE_LABELS: Record<string, string> = { ACCESS: 'Erişim', CORRECTION: 'Düzeltme', DELETION: 'Silme', RESTRICTION: 'Kısıtlama', OBJECTION: 'İtiraz', PORTABILITY: 'Taşınabilirlik', OTHER: 'Diğer' };
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };
const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'> = { DRAFT: 'neutral', SUBMITTED: 'accent', APPROVED: 'ok', REJECTED: 'danger', REVISION_REQUIRED: 'warn', CANCELLED: 'neutral' };

export default async function DsrPage() {
  const session = await requireFactoryAdmin();
  const requests = await listDataSubjectRequests(session.companyId);

  return (
    <div>
      <PageHeader eyebrow="Core Security · KVKK" title="Veri Sahibi Talepleri" description="Erişim/düzeltme/silme/kısıtlama/itiraz/taşınabilirlik talepleri — jenerik onay motoruna documentType='DATA_SUBJECT_REQUEST' ile bağlı (madde 22)." />

      <GlassPanel className="mb-5"><CreateDsrForm /></GlassPanel>

      <GlassPanel>
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="py-3 border-b border-white/[0.05] last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{r.requestNo}</span>
                  <span className="ml-2">{TYPE_LABELS[r.requestType] ?? r.requestType} — {r.subjectName}</span>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-dim)' }}>{r.description}</p>
              {r.resolutionNote ? <p className="text-xs mt-1" style={{ color: 'var(--aurora-emerald)' }}>Sonuç: {r.resolutionNote}</p> : null}
              <div className="mt-2">
                {r.status === 'DRAFT' || r.status === 'REVISION_REQUIRED' ? <SubmitDsrButton requestId={r.id} /> : null}
                {r.status === 'APPROVED' && !r.resolutionNote ? <ResolveDsrForm requestId={r.id} /> : null}
              </div>
            </div>
          ))}
          {requests.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz talep yok.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}
