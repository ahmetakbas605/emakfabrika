import { requireDepartmentAccess, listCompanyUsers } from '@/lib/dal';
import { getEmployee, listEmployees } from '@/lib/hr/employees';
import { listEmployeeContracts } from '@/lib/hr/contracts';
import { listEmployeeQualifications } from '@/lib/hr/qualifications';
import { listCompensationHistory } from '@/lib/hr/compensation';
import { listBonusRequests } from '@/lib/hr/bonus';
import { listAttachments } from '@/lib/documents/attachments';
import { listCompanyDepartments } from '@/lib/departments';
import { listPositions } from '@/lib/org';
import { listCostCenters } from '@/lib/cost-centers';
import { listCurrencies } from '@/lib/master-data/currency';
import { OrganizationForm } from '@/components/hr/organization-form';
import { ContactForm, AddressForm, EmergencyContactForm, TerminateForm, LinkUserForm } from '@/components/hr/personnel-forms';
import { ContractForm } from '@/components/hr/contract-form';
import { QualificationForm, RevokeQualificationButton } from '@/components/hr/qualification-form';
import { CompensationForm } from '@/components/hr/compensation-forms';
import { BonusForm, SubmitBonusButton, CancelBonusButton, BONUS_TYPE_LABELS } from '@/components/hr/bonus-forms';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', ON_LEAVE: 'İzinde', SUSPENDED: 'Askıda', TERMINATED: 'İşten Ayrıldı' };
const CONTACT_TYPE_LABELS: Record<string, string> = { PHONE_MOBILE: 'Cep Telefonu', PHONE_HOME: 'Ev Telefonu', PHONE_WORK: 'İş Telefonu', EMAIL_PERSONAL: 'Kişisel E-posta', EMAIL_WORK: 'İş E-postası', OTHER: 'Diğer' };
const ADDRESS_TYPE_LABELS: Record<string, string> = { HOME: 'Ev', WORK: 'İş', OTHER: 'Diğer' };
const CONTRACT_TYPE_LABELS: Record<string, string> = { INDEFINITE: 'Belirsiz Süreli', DEFINITE: 'Belirli Süreli', PART_TIME: 'Kısmi Zamanlı', INTERNSHIP: 'Stajyer', CONSULTANT: 'Danışman' };
const CONTRACT_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Yürürlükte', SUPERSEDED: 'Yenilendi', EXPIRED: 'Süresi Doldu', TERMINATED: 'Feshedildi' };
const QUALIFICATION_TYPE_LABELS: Record<string, string> = { DIPLOMA: 'Diploma', CERTIFICATE: 'Sertifika', TRAINING: 'Eğitim', LICENSE: 'Lisans', OTHER: 'Diğer' };
const QUALIFICATION_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Geçerli', EXPIRED: 'Süresi Doldu', REVOKED: 'İptal Edildi' };
const COMPENSATION_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Yürürlükte', SUPERSEDED: 'Değişti' };
const BONUS_STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ departmentId: string; employeeId: string }> }) {
  const { departmentId, employeeId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [detail, employees, departments, positions, costCenters, companyUsers, contracts, qualifications, compensationHistory, bonusRequests, currencies] = await Promise.all([
    getEmployee(session.companyId, employeeId),
    listEmployees(session.companyId),
    listCompanyDepartments(session.companyId),
    listPositions(session.companyId),
    listCostCenters(session.companyId),
    listCompanyUsers(session.companyId),
    listEmployeeContracts(session.companyId, employeeId),
    listEmployeeQualifications(session.companyId, employeeId),
    listCompensationHistory(session.companyId, employeeId),
    listBonusRequests(session.companyId, employeeId),
    listCurrencies()
  ]);
  const { employee, departmentName, positionTitle, managerName, costCenterName, shiftName, linkedUser, contacts, addresses, emergencyContacts } = detail;
  const [contractAttachments, qualificationAttachments] = await Promise.all([
    Promise.all(contracts.map((c) => listAttachments(session.companyId, 'EMPLOYEE_CONTRACT', c.id))),
    Promise.all(qualifications.map((q) => listAttachments(session.companyId, 'EMPLOYEE_QUALIFICATION', q.id)))
  ]);

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
          <tr><td style={{ padding: '4px 12px 4px 0', color: '#666' }}>Vardiya</td><td>{shiftName ?? '—'}<span style={{ color: '#999', fontSize: 12 }}> (PDKS sayfasından atanır)</span></td></tr>
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

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ücret Geçmişi</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Versiyon</th><th style={{ padding: '6px 8px' }}>Yürürlük</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Maaş</th><th style={{ padding: '6px 8px' }}>Neden</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {compensationHistory.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>v{c.version}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.effectiveDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.baseSalary} {c.currencyCode}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.changeReason || '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{COMPENSATION_STATUS_LABELS[c.status] ?? c.status}</td>
            </tr>
          ))}
          {compensationHistory.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz maaş kaydı yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><CompensationForm departmentId={departmentId} employeeId={employeeId} currencies={currencies.map((c) => ({ code: c.code, name: c.name }))} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Ödüller / Bonuslar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {bonusRequests.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{b.bonusNo}</td>
              <td style={{ padding: '6px 8px' }}>{BONUS_TYPE_LABELS[b.bonusType] ?? b.bonusType}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{b.amount} {b.currencyCode}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{BONUS_STATUS_LABELS[b.status] ?? b.status}</td>
              <td style={{ padding: '6px 8px' }}>
                {b.status === 'DRAFT' || b.status === 'REVISION_REQUIRED' ? (
                  <>
                    <SubmitBonusButton departmentId={departmentId} employeeId={employeeId} bonusRequestId={b.id} />
                    <CancelBonusButton departmentId={departmentId} employeeId={employeeId} bonusRequestId={b.id} />
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {bonusRequests.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz ödül talebi yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><BonusForm departmentId={departmentId} employeeId={employeeId} currencies={currencies.map((c) => ({ code: c.code, name: c.name }))} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sözleşmeler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Versiyon</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Başlangıç</th>
            <th style={{ padding: '6px 8px' }}>Bitiş</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Belge</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c, i) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>v{c.version}</td>
              <td style={{ padding: '6px 8px' }}>{CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.startDate}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.endDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{contractAttachments[i].map((a) => a.fileName).join(', ') || '—'}</td>
            </tr>
          ))}
          {contracts.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz sözleşme yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><ContractForm departmentId={departmentId} employeeId={employeeId} /></div> : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Belgeler / Diploma / Sertifika / Eğitim</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Tür</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Veren Kurum</th>
            <th style={{ padding: '6px 8px' }}>Geçerlilik</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Belge</th>
            <th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {qualifications.map((q, i) => (
            <tr key={q.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{QUALIFICATION_TYPE_LABELS[q.qualificationType] ?? q.qualificationType}</td>
              <td style={{ padding: '6px 8px' }}>{q.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{q.institution || '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{q.expiryDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{QUALIFICATION_STATUS_LABELS[q.status] ?? q.status}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{qualificationAttachments[i].map((a) => a.fileName).join(', ') || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.update && q.status === 'ACTIVE' ? <RevokeQualificationButton departmentId={departmentId} employeeId={employeeId} qualificationId={q.id} /> : null}</td>
            </tr>
          ))}
          {qualifications.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Henüz belge/eğitim kaydı yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.update ? <div style={{ marginBottom: 24 }}><QualificationForm departmentId={departmentId} employeeId={employeeId} /></div> : null}

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
