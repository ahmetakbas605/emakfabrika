import { requireFactoryAdmin, listCompanyUsers } from '@/lib/dal';
import { listWorkflowRules } from '@/lib/workflow/engine';
import { listPositions } from '@/lib/org';
import { WorkflowRuleForm } from '@/components/workflow/workflow-rule-form';
import type { WorkflowConditions, WorkflowChainStep } from '@/lib/workflow/types';

const APPROVER_TYPE_LABEL: Record<string, string> = { POSITION: 'Pozisyon', SPECIFIC_USER: 'Kullanıcı', MANAGER_CHAIN: 'Yönetici Zinciri' };

export default async function WorkflowRulesPage() {
  const session = await requireFactoryAdmin();
  const [rules, positions, users] = await Promise.all([listWorkflowRules(session.companyId), listPositions(session.companyId), listCompanyUsers(session.companyId)]);
  const positionById = new Map(positions.map((p) => [p.id, p.title]));
  const userById = new Map(users.map((u) => [u.id, u.fullName]));

  function describeCondition(c: WorkflowConditions | null): string {
    if (!c) return 'her zaman';
    const parts: string[] = [];
    if (c.minAmount !== undefined) parts.push(`≥ ${c.minAmount}`);
    if (c.maxAmount !== undefined) parts.push(`≤ ${c.maxAmount}`);
    if (c.categoryCode) parts.push(`kategori=${c.categoryCode}`);
    if (c.capexOpex) parts.push(c.capexOpex);
    return parts.length > 0 ? parts.join(', ') : 'her zaman';
  }

  function describeStep(s: WorkflowChainStep): string {
    const label = s.approverType === 'POSITION' ? (positionById.get(s.approverValue) ?? '?') : s.approverType === 'SPECIFIC_USER' ? (userById.get(s.approverValue) ?? '?') : `${s.approverValue}. seviye yönetici`;
    const modeLabel = s.mode === 'PARALLEL' ? ` (quorum: ${s.quorum ?? 1})` : '';
    return `${APPROVER_TYPE_LABEL[s.approverType]}: ${label}${modeLabel}`;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Onay Kuralları</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Genel workflow motoru — belge türüne (documentType) göre eşleşen kural, tutar/kategori/CAPEX-OPEX koşullarına göre seçilir. Hard-code onay eşiği yok.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Belge Türü</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Koşul</th>
            <th style={{ padding: '6px 8px' }}>Zincir</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Öncelik</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.documentType}</td>
              <td style={{ padding: '6px 8px' }}>{r.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{describeCondition(r.conditions as WorkflowConditions | null)}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{(r.approvalChain as WorkflowChainStep[]).map((s, i) => `${i + 1}) ${describeStep(s)}`).join('  →  ')}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.priority}</td>
            </tr>
          ))}
          {rules.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz onay kuralı yok.</td></tr> : null}
        </tbody>
      </table>

      <WorkflowRuleForm positions={positions.map((p) => ({ id: p.id, title: p.title }))} users={users.map((u) => ({ id: u.id, fullName: u.fullName }))} />
    </div>
  );
}
