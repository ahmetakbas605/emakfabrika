import { requireDepartmentAccess } from '@/lib/dal';
import { listAccounts } from '@/lib/accounting';
import { AccountForm } from '@/components/account-form';

export default async function AccountsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const accounts = await listAccounts(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Hesap Planı</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{accounts.length} hesap — Tek Düzen Hesap Planına göre kullanıcı tanımlı (PDF madde 15).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Normal Bakiye</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.code}</td>
              <td style={{ padding: '6px 8px' }}>{a.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.accountType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.normalBalance}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {access.permissions.create ? <AccountForm departmentId={departmentId} /> : null}
    </div>
  );
}
