import { requireDepartmentAccess } from '@/lib/dal';
import { listChecks } from '@/lib/checks';
import { listAccounts } from '@/lib/accounting';
import { CheckForm } from '@/components/check-form';
import { CheckTransitionForm } from '@/components/check-transition-form';

const STATUS_LABELS: Record<string, string> = {
  PORTFOLIO: 'Portföyde', COLLECTED: 'Tahsil Edildi', ENDORSED: 'Ciro Edildi', BOUNCED: 'Karşılıksız', RETURNED: 'İade Edildi',
  DRAFTED: 'Düzenlendi', DELIVERED: 'Teslim Edildi', PAID: 'Ödendi', CANCELLED: 'İptal Edildi'
};

function money(value: string): string {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export default async function ChecksPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [allChecks, accounts] = await Promise.all([listChecks(session.companyId), listAccounts(session.companyId)]);
  const accountOptions = accounts.map((a) => ({ code: a.code, name: a.name }));
  const accountOptionsWithId = accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Çek / Senet</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Her durum geçişi otomatik muhasebe fişi üretir (PDF madde 28).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Yön</th>
            <th style={{ padding: '6px 8px' }}>Çek No</th>
            <th style={{ padding: '6px 8px' }}>Taraf</th>
            <th style={{ padding: '6px 8px' }}>Vade</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {allChecks.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{c.direction === 'RECEIVED' ? 'Alınan' : 'Verilen'}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.checkNo}</td>
              <td style={{ padding: '6px 8px' }}>{c.partyName}</td>
              <td style={{ padding: '6px 8px' }}>{c.dueDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(c.amount)}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[c.status] ?? c.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {access.permissions.post ? <CheckTransitionForm departmentId={departmentId} checkId={c.id} direction={c.direction} status={c.status} accounts={accountOptions} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {access.permissions.create ? <CheckForm departmentId={departmentId} accounts={accountOptionsWithId} /> : null}
    </div>
  );
}
