import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listBudgets } from '@/lib/budgets';
import { BudgetForm } from '@/components/budget-form';

export default async function BudgetsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const budgets = await listBudgets(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Bütçe</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Bütçe kalemleri muhasebe fişi üretmez — yalnızca gerçekleşenle karşılaştırılır (PDF madde 35).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Dönem</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/departments/${departmentId}/budgets/${b.id}`}>{b.name}</Link></td>
              <td style={{ padding: '6px 8px' }}>{b.periodStart} — {b.periodEnd}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{b.status}</td>
            </tr>
          ))}
          {budgets.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: '#999' }}>Henüz bütçe yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <BudgetForm departmentId={departmentId} /> : null}
    </div>
  );
}
