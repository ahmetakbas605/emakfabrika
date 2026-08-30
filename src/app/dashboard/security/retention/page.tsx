import { requireFactoryAdmin } from '@/lib/dal';
import { listRetentionPolicies, listActiveLegalHolds } from '@/lib/security/retention';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { RetentionPolicyForm, LegalHoldForm, ReleaseLegalHoldButton } from '@/components/security/admin-forms';

const METHOD_LABELS: Record<string, string> = { HARD_DELETE: 'Tamamen Sil', ANONYMIZE: 'Anonimleştir', ARCHIVE: 'Arşivle' };

export default async function RetentionPage() {
  const session = await requireFactoryAdmin();
  const [policies, holds] = await Promise.all([listRetentionPolicies(session.companyId), listActiveLegalHolds(session.companyId)]);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Saklama" title="Saklama Politikaları / Legal Hold" description="Süre değerleri kod içine gömülmez — hukuki doğrulama sonrası buradan girilir (madde 23-26). Legal hold aktifken ilgili kayıt silinemez/anonimleştirilemez." />

      <GlassPanel title="Saklama Politikaları" className="mb-5">
        <div className="mb-4"><RetentionPolicyForm /></div>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b" style={{ borderColor: 'var(--aurora-border)' }}><th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Veri Türü</th><th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Süre</th><th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Yöntem</th><th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Yasal Dayanak</th></tr></thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-b" style={{ borderColor: 'var(--aurora-border)' }}>
                <td className="py-2 pr-3">{p.dataType}</td>
                <td className="py-2 pr-3">{p.retentionYears} yıl</td>
                <td className="py-2 pr-3"><Badge>{METHOD_LABELS[p.deleteMethod] ?? p.deleteMethod}</Badge></td>
                <td className="py-2 pr-3 text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{p.legalBasis || '—'}</td>
              </tr>
            ))}
            {policies.length === 0 ? <tr><td colSpan={4} className="py-4 text-center text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz politika yok.</td></tr> : null}
          </tbody>
        </table>
      </GlassPanel>

      <GlassPanel title="Aktif Legal Hold">
        <div className="mb-4"><LegalHoldForm /></div>
        <div className="space-y-2">
          {holds.map((h) => (
            <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.05] last:border-0">
              <div>
                <span className="font-mono text-xs">{h.entityType}</span> <span className="text-xs" style={{ color: 'var(--aurora-text-faint)' }}>{h.entityId.slice(0, 8)}</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-dim)' }}>{h.reason}</p>
              </div>
              <ReleaseLegalHoldButton legalHoldId={h.id} />
            </div>
          ))}
          {holds.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Aktif legal hold yok.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}
