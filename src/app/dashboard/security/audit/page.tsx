import { requireFactoryAdmin } from '@/lib/dal';
import { listAuditLogs, verifyAuditChain } from '@/lib/security/audit';
import { PageHeader, GlassPanel, RiskBadge, Badge } from '@/components/shell/ui';

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('tr-TR');
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const session = await requireFactoryAdmin();
  const { entity } = await searchParams;

  const [logs, chain] = await Promise.all([
    listAuditLogs(session.companyId, entity ? { entity } : undefined),
    verifyAuditChain(session.companyId)
  ]);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Audit" title="Audit Trail" description="Her kritik işlem (giriş/çıkış, export, onay, rol değişikliği...) burada — hash zinciriyle sonradan müdahaleye karşı korunuyor (madde 13)." />

      <GlassPanel title="Bütünlük Doğrulaması" className="mb-5">
        <div className="flex items-center gap-3">
          <Badge tone={chain.ok ? 'ok' : 'danger'}>{chain.ok ? 'ZİNCİR SAĞLAM' : 'ZİNCİR BOZUK'}</Badge>
          <span className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>
            {chain.checked} kayıt kontrol edildi{chain.skippedLegacy > 0 ? ` (+ ${chain.skippedLegacy} zincir-öncesi eski kayıt atlandı)` : ''}{!chain.ok ? ` — bozulma noktası: ${chain.brokenAtId}` : ''}
          </span>
        </div>
      </GlassPanel>

      <form method="get" className="mb-4 flex gap-2">
        <input name="entity" defaultValue={entity ?? ''} placeholder="Varlık filtrele (örn. USER, EMPLOYEE_CONTRACT)" className="px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.09] outline-none flex-1 max-w-sm" />
        <button type="submit" className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--aurora-border-strong)' }}>Filtrele</button>
      </form>

      <GlassPanel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--aurora-border)' }}>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Zaman</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>İşlem</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Varlık</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Modül</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Risk</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b" style={{ borderColor: 'var(--aurora-border)' }}>
                  <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{formatDateTime(l.createdAt)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{l.action}</td>
                  <td className="py-2 pr-3">{l.entity}{l.entityId ? <span className="text-xs ml-1" style={{ color: 'var(--aurora-text-faint)' }}>{l.entityId.slice(0, 8)}</span> : null}</td>
                  <td className="py-2 pr-3 text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{l.module ?? '—'}</td>
                  <td className="py-2 pr-3"><RiskBadge level={l.riskLevel} /></td>
                  <td className="py-2 pr-3"><Badge tone={l.result === 'SUCCESS' ? 'ok' : 'danger'}>{l.result}</Badge></td>
                </tr>
              ))}
              {logs.length === 0 ? <tr><td colSpan={6} className="py-4 text-center text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Kayıt yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
