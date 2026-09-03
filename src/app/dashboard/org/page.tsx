import { requireFactoryAdmin } from '@/lib/dal';
import { listPositions, listCompanyOrgUsers } from '@/lib/org';
import { listCompanyDepartments, listDepartmentTypes } from '@/lib/departments';
import { PositionForm } from '@/components/org/position-form';
import { OrgAssignmentForm } from '@/components/org/org-assignment-form';
import { DepartmentForm } from '@/components/org/department-form';

export default async function OrgPage() {
  const session = await requireFactoryAdmin();
  const [positions, orgUsers, departmentList, departmentTypes] = await Promise.all([
    listPositions(session.companyId),
    listCompanyOrgUsers(session.companyId),
    listCompanyDepartments(session.companyId),
    listDepartmentTypes()
  ]);
  const departmentTypeNameByCode = new Map(departmentTypes.map((t) => [t.code, t.name]));
  const departmentNameById = new Map(departmentList.map((d) => [d.id, d.name]));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Organizasyon</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Dinamik pozisyon + raporlama zinciri — workflow motorunun POSITION/MANAGER_CHAIN onay adımları buradan beslenir.</p>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Departmanlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Üst Departman</th>
          </tr>
        </thead>
        <tbody>
          {departmentList.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{d.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{departmentTypeNameByCode.get(d.departmentTypeCode) ?? d.departmentTypeCode}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{d.parentDepartmentId ? (departmentNameById.get(d.parentDepartmentId) ?? '—') : '—'}</td>
            </tr>
          ))}
          {departmentList.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz departman yok.</td></tr> : null}
        </tbody>
      </table>
      <div style={{ marginBottom: 28 }}>
        <DepartmentForm departmentTypes={departmentTypes} departments={departmentList.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Pozisyonlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Unvan</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Onay Seviyesi</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{p.code}</td>
              <td style={{ padding: '6px 8px' }}>{p.title}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--dim-on-surface-variant)' }}>{p.approvalLevel}</td>
            </tr>
          ))}
          {positions.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz pozisyon yok.</td></tr> : null}
        </tbody>
      </table>
      <div style={{ marginBottom: 28 }}><PositionForm /></div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kullanıcı Atamaları</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kullanıcı</th>
            <th style={{ padding: '6px 8px' }}>Mevcut Pozisyon</th>
            <th style={{ padding: '6px 8px' }}>Mevcut Yönetici</th>
            <th style={{ padding: '6px 8px' }}>Değiştir</th>
          </tr>
        </thead>
        <tbody>
          {orgUsers.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{u.fullName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{u.positionTitle ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{u.managerName ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>
                <OrgAssignmentForm userId={u.id} positions={positions.map((p) => ({ id: p.id, title: p.title }))} users={orgUsers.map((x) => ({ id: x.id, fullName: x.fullName }))} currentPositionId={u.positionId} currentManagerUserId={u.managerUserId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
