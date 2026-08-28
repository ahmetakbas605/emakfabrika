import { requireDepartmentAccess } from '@/lib/dal';
import { listAccounts } from '@/lib/accounting';
import { JournalForm } from '@/components/journal-form';

export default async function NewJournalPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const accounts = await listAccounts(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Yeni Muhasebe Fişi</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Toplam borç, toplam alacağa eşit olmadan kaydedilemez (PDF madde 86).</p>
      <JournalForm departmentId={departmentId} accounts={accounts.map((a) => ({ code: a.code, name: a.name }))} />
    </div>
  );
}
