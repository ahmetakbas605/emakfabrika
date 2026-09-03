import { requireDepartmentAccess } from '@/lib/dal';
import { getBudgetVsActual } from '@/lib/budgets';
import { listAccounts } from '@/lib/accounting';
import { BudgetItemForm } from '@/components/budget-item-form';

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export default async function BudgetDetailPage({ params }: { params: Promise<{ departmentId: string; budgetId: string }> }) {
  const { departmentId, budgetId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [rows, accounts] = await Promise.all([getBudgetVsActual(session.companyId, budgetId), listAccounts(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Bütçe — Gerçekleşen Karşılaştırması</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Sapma = Planlanan − Gerçekleşen.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Hesap</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Planlanan</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Gerçekleşen</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Sapma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountCode} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{r.accountCode} — {r.accountName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(r.planned)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(r.actual)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: Number(r.variance) < 0 ? '#b00' : 'var(--dim-success)' }}>{money(r.variance)}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz bütçe kalemi yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <BudgetItemForm departmentId={departmentId} budgetId={budgetId} accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} /> : null}
    </div>
  );
}
