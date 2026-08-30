import { requireFactoryAdmin } from '@/lib/dal';
import { listInventory } from '@/lib/security/classification';
import { PageHeader, GlassPanel, Badge } from '@/components/shell/ui';
import { InventoryForm, DeleteInventoryButton } from '@/components/security/admin-forms';

const CLASS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'> = {
  PUBLIC: 'neutral', INTERNAL: 'neutral', CONFIDENTIAL: 'accent', PERSONAL: 'warn', SPECIAL_CATEGORY: 'danger', FINANCIAL: 'warn', HIGHLY_CONFIDENTIAL: 'danger', SYSTEM_SECURITY: 'danger'
};

export default async function ClassificationPage() {
  const session = await requireFactoryAdmin();
  const entries = await listInventory(session.companyId);

  return (
    <div>
      <PageHeader eyebrow="Core Security · Veri Sınıflandırma" title="Kişisel Veri Envanteri" description="Her hassas tablo.kolon çifti için sınıflandırma + maskeleme/şifreleme gereksinimi (madde 3-4). Bu bir REHBER — gerçek maskeleme lib/security/masking.ts'te kod içinde uygulanır." />

      <GlassPanel className="mb-5">
        <InventoryForm />
      </GlassPanel>

      <GlassPanel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--aurora-border)' }}>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Tablo.Kolon</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Sınıflandırma</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Amaç</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Maskeleme</th>
                <th className="py-2 pr-3 font-medium" style={{ color: 'var(--aurora-text-dim)' }}>Şifreleme</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b" style={{ borderColor: 'var(--aurora-border)' }}>
                  <td className="py-2 pr-3 font-mono text-xs">{e.tableName}.{e.columnName}</td>
                  <td className="py-2 pr-3"><Badge tone={CLASS_TONE[e.classification] ?? 'neutral'}>{e.classification}</Badge></td>
                  <td className="py-2 pr-3 text-xs" style={{ color: 'var(--aurora-text-dim)' }}>{e.purpose || '—'}</td>
                  <td className="py-2 pr-3 text-xs">{e.maskingRequired ? 'Evet' : '—'}</td>
                  <td className="py-2 pr-3 text-xs">{e.encryptionRequired ? 'Evet' : '—'}</td>
                  <td className="py-2 pr-3"><DeleteInventoryButton entryId={e.id} /></td>
                </tr>
              ))}
              {entries.length === 0 ? <tr><td colSpan={6} className="py-4 text-center text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz envanter kaydı yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
