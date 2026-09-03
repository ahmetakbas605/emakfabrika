import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listEmployees } from '@/lib/hr/employees';
import { listCompanyDepartments } from '@/lib/departments';
import { listPositions } from '@/lib/org';
import { listCostCenters } from '@/lib/cost-centers';
import { EmployeeForm } from '@/components/hr/employee-form';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', ON_LEAVE: 'İzinde', SUSPENDED: 'Askıda', TERMINATED: 'İşten Ayrıldı' };

export default async function HrEmployeesPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [employees, departments, positions, costCenters] = await Promise.all([
    listEmployees(session.companyId),
    listCompanyDepartments(session.companyId),
    listPositions(session.companyId),
    listCostCenters(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Çalışanlar</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Özlük çekirdeği — personel kartı, iletişim/adres/acil durum kişileri detay sayfasında (İK Mimarisi Faz 0).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Sicil No</th>
            <th style={{ padding: '6px 8px' }}>Ad Soyad</th>
            <th style={{ padding: '6px 8px' }}>Departman</th>
            <th style={{ padding: '6px 8px' }}>Pozisyon</th>
            <th style={{ padding: '6px 8px' }}>İşe Giriş</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                <Link href={`/dashboard/departments/${departmentId}/hr/employees/${e.id}`}>{e.employeeNumber}</Link>
              </td>
              <td style={{ padding: '6px 8px' }}>
                <Link href={`/dashboard/departments/${departmentId}/hr/employees/${e.id}`} style={{ color: 'var(--dim-bone)', textDecoration: 'none' }}>{e.firstName} {e.lastName}</Link>
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{e.departmentName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{e.positionTitle ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{e.hireDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[e.employmentStatus] ?? e.employmentStatus}</td>
            </tr>
          ))}
          {employees.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz çalışan yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? (
        <EmployeeForm
          departmentId={departmentId}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p) => ({ id: p.id, title: p.title }))}
          employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))}
          costCenters={costCenters.map((c) => ({ id: c.id, name: c.name }))}
        />
      ) : null}
    </div>
  );
}
