import { requireDepartmentAccess, listCompanyUsers } from '@/lib/dal';
import { getEmployee, listEmployees } from '@/lib/hr/employees';
import { listCompanyDepartments } from '@/lib/departments';
import { listPositions } from '@/lib/org';
import { listCostCenters } from '@/lib/cost-centers';
import { OrganizationForm } from '@/components/hr/organization-form';
import { ContactForm, AddressForm, EmergencyContactForm, TerminateForm, LinkUserForm } from '@/components/hr/personnel-forms';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', ON_LEAVE: 'İzinde', SUSPENDED: 'Askıda', TERMINATED: 'İşten Ayrıldı' };
const CONTACT_TYPE_LABELS: Record<string, string> = { PHONE_MOBILE: 'Cep Telefonu', PHONE_HOME: 'Ev Telefonu', PHONE_WORK: 'İş Telefonu', EMAIL_PERSONAL: 'Kişisel E-posta', EMAIL_WORK: 'İş E-postası', OTHER: 'Diğer' };
const ADDRESS_TYPE_LABELS: Record<string, string> = { HOME: 'Ev', WORK: 'İş', OTHER: 'Diğer' };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ departmentId: string; employeeId: string }> }) {
  const { departmentId, employeeId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [detail, employees, departments, positions, costCenters, companyUsers] = await Promise.all([
    getEmployee(session.companyId, employeeId),
    listEmployees(session.companyId),
    listCompanyDepartments(session.companyId),
    listPositions(session.companyId),
    listCostCenters(session.companyId),
    listCompanyUsers(session.companyId)
  ]);
  const { employee, departmentName, positionTitle, managerName, costCenterName, linkedUser, contacts, addresses, emergencyContacts } = detail;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{employee.firstName} {employee.lastName}</h1>
        <span style={{ fontFamily: 'monospace', color: '#666' }}>{employee.employeeNumber}</span>
      </div>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Durum: <strong>{STATUS_LABELS[employee.employmentStatus] ?? employee.employmentStatus}</strong> · İşe Giriş: {employee.hireDate}{employee.terminationDate ? ` · İşten Ayrılış: ${employee.terminationDate}` : ''}</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Genel Bilgiler</h2>
      <table style={{ fontSize: 13, marginBottom: 24, borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Doğum Tarihi</td><td>{employee.birthDate ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Uyruk</td><td>{employee.nationality ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Cinsiyet</td><td>{employee.gender ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Medeni Hal</td><td>{employee.maritalStatus ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>ERP Hesabı</td><td>{linkedUser ? `${linkedUser.fullName} (${linkedUser.email})` : '—'}</td></tr>
        </tbody>
      </table>
      {access.permissions.update && !linkedUser ? (
        <div style={{ marginBottom: 24 }}>
          <LinkUserForm departmentId={departmentId} employeeId={employeeId} users={companyUsers.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }))} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Organizasyon</h2>
      <table style={{ fontSize: 13, marginBottom: 12, borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Departman</td><td>{departmentName ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Pozisyon</td><td>{positionTitle ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Yönetici</td><td>{managerName ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Masraf Merkezi</td><td>{costCenterName ?? '—'}</td></tr>
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Çalışma Yeri</td><td>{employee.workLocation || '—'}</td></tr>
        </tbody>
      </table>
      {access.permissions.update ? (
        <div style={{ marginBottom: 24 }}>
          <OrganizationForm
            departmentId={departmentId} employeeId={employeeId}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            positions={positions.map((p) => ({ id: p.id, title: p.title }))}
            employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))}
            costCenters={costCenters.map((c) => ({ id: c.id, name: c.name }))}
            current={{ departmentId: employee.departmentId, positionId: employee.positionId, managerEmployeeId: employee.managerEmployeeId, costCenterId: employee.costCenterId, workLocation: employee.workLocation }}
          />
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>İletişim</h2>
      <ul style={{ fontSize: 13, marginBottom: 8, paddingLeft: 18 }}>
        {contacts.map((c) => <li key={c.id}>{CONTACT_TYPE_LABELS[c.contactType] ?? c.contactType}: {c.value}{c.isPrimary ? ' (birincil)' : ''}</li>)}
        {contacts.length === 0 ? <li style={{ color: '#999', listStyle: 'none', marginLeft: -18 }}>Henüz iletişim bilgisi yok.</li> : null}
      </ul>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><ContactForm departmentId={departmentId} employeeId={employeeId} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Adresler</h2>
      <ul style={{ fontSize: 13, marginBottom: 8, paddingLeft: 18 }}>
        {addresses.map((a) => <li key={a.id}>{ADDRESS_TYPE_LABELS[a.addressType] ?? a.addressType}: {a.line}, {a.district} {a.city} {a.postalCode}{a.isPrimary ? ' (birincil)' : ''}</li>)}
        {addresses.length === 0 ? <li style={{ color: '#999', listStyle: 'none', marginLeft: -18 }}>Henüz adres yok.</li> : null}
      </ul>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><AddressForm departmentId={departmentId} employeeId={employeeId} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Acil Durum Kişileri</h2>
      <ul style={{ fontSize: 13, marginBottom: 8, paddingLeft: 18 }}>
        {emergencyContacts.map((c) => <li key={c.id}>{c.fullName} ({c.relationship || '—'}): {c.phone}</li>)}
        {emergencyContacts.length === 0 ? <li style={{ color: '#999', listStyle: 'none', marginLeft: -18 }}>Henüz acil durum kişisi yok.</li> : null}
      </ul>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><EmergencyContactForm departmentId={departmentId} employeeId={employeeId} /></div> : null}

      {access.permissions.update && employee.employmentStatus !== 'TERMINATED' ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>İşten Ayrılış</h2>
          <TerminateForm departmentId={departmentId} employeeId={employeeId} />
        </>
      ) : null}
    </div>
  );
}
