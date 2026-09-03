import { requireDepartmentAccess } from '@/lib/dal';
import { listAccounts } from '@/lib/accounting';
import { listCostCenters } from '@/lib/cost-centers';
import { JournalForm } from '@/components/journal-form';

export default async function NewJournalPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const [accounts, costCenters] = await Promise.all([listAccounts(session.companyId), listCostCenters(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Yeni Muhasebe Fişi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Toplam borç, toplam alacağa eşit olmadan kaydedilemez (PDF madde 86).</p>
      <JournalForm
        departmentId={departmentId}
        accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
        costCenters={costCenters.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      />
    </div>
  );
}
