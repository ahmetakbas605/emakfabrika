import { requireFactoryAdmin } from '@/lib/dal';
import { listRoleConflictRules } from '@/lib/security/sod';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { SodForm, DeactivateSodButton } from '@/components/security/admin-forms';

export default async function SodPage() {
  const session = await requireFactoryAdmin();
  const rules = await listRoleConflictRules(session.companyId);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Görevler Ayrılığı" title="Segregation of Duties" description="Aynı kişinin bir belgeyi oluşturup onaylamasını engelleyen kurallar (madde 58). Jenerik onay motoru DEĞİŞMEDİ — bu, actOnXStep çağrılmadan önceki bağımsız bir kontrol." />

      <GlassPanel className="mb-5"><SodForm /></GlassPanel>

      <GlassPanel>
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.05] last:border-0">
              <div>
                <Badge tone="accent">{r.documentType}</Badge>
                <span className="ml-2 font-mono text-xs">{r.rule}</span>
                {r.description ? <span className="ml-2 text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{r.description}</span> : null}
              </div>
              <DeactivateSodButton ruleId={r.id} />
            </div>
          ))}
          {rules.length === 0 ? <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz kural yok.</p> : null}
        </div>
      </GlassPanel>
    </div>
  );
}
