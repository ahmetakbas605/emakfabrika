import { requireDepartmentAccess } from '@/lib/dal';
import { listChanges, requiresApproval } from '@/lib/it/changes';
import { ChangeForm } from '@/components/it/change-form';
import { ChangeApprovalForm } from '@/components/it/change-approval-form';

export default async function ChangesPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const changes = await listChanges(session.companyId);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Değişiklik Yönetimi (Change Management)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Risk veya etki HIGH/CRITICAL ise planlanmadan önce en az bir onay kaydı gerekir (SERVICE-DESK.md §6).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Risk</th>
            <th style={{ padding: '6px 8px' }}>Etki</th>
            <th style={{ padding: '6px 8px' }}>Onay Gerekli mi</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Talep Eden</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => {
            const needsApproval = requiresApproval(c.riskLevel, c.impactLevel);
            return (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{c.title}</td>
                <td style={{ padding: '6px 8px' }}>{c.riskLevel}</td>
                <td style={{ padding: '6px 8px' }}>{c.impactLevel}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{needsApproval ? 'Evet' : 'Hayır'}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.status}</td>
                <td style={{ padding: '6px 8px', color: '#666' }}>{c.requestedByName}</td>
                <td style={{ padding: '6px 8px' }}>
                  {c.status === 'DRAFT' ? (
                    <ChangeApprovalForm departmentId={departmentId} changeId={c.id} canApprove={!!access.permissions.approve && needsApproval} canSchedule={!!access.permissions.update} />
                  ) : null}
                </td>
              </tr>
            );
          })}
          {changes.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Henüz değişiklik talebi yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <ChangeForm departmentId={departmentId} /> : null}
    </div>
  );
}
