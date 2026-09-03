import { requireDepartmentAccess } from '@/lib/dal';
import { listLeaveRequests } from '@/lib/hr/leave';
import { listOvertimeRequests } from '@/lib/hr/overtime';
import { listEmployees } from '@/lib/hr/employees';
import { SetEntitlementForm, LEAVE_TYPE_LABELS } from '@/components/hr/leave-forms';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

export default async function HrLeaveAdminPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session } = await requireDepartmentAccess(departmentId);

  const [leaveRequests, overtimeRequests, employees] = await Promise.all([
    listLeaveRequests(session.companyId),
    listOvertimeRequests(session.companyId),
    listEmployees(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İzin / Fazla Mesai Yönetimi</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Şirket geneli görünüm — çalışanlar kendi taleplerini "İzin Taleplerim"/"Fazla Mesai Taleplerim" sayfalarından oluşturur, onay Onay Kutusu üzerinden yürür.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>İzin Hak Ediş Tanımlama</h2>
      <p style={{ color: 'var(--dim-on-surface-variant)', fontSize: 12, marginBottom: 8 }}>Yasal/kıdem bazlı hesaplama yok — hak ediş İK tarafından doğrudan girilir (madde 33/199 ilkesi).</p>
      <div style={{ marginBottom: 24 }}>
        <SetEntitlementForm departmentId={departmentId} employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))} currentYear={new Date().getFullYear()} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tüm İzin Talepleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Tür</th><th style={{ padding: '6px 8px' }}>Tarih Aralığı</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Gün</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {leaveRequests.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.leaveNo}</td>
              <td style={{ padding: '6px 8px' }}>{r.employeeFirstName} {r.employeeLastName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.startDate} – {r.endDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.dayCount}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[r.status] ?? r.status}</td>
            </tr>
          ))}
          {leaveRequests.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz izin talebi yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tüm Fazla Mesai Talepleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Saat</th><th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {overtimeRequests.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.overtimeNo}</td>
              <td style={{ padding: '6px 8px' }}>{r.employeeFirstName} {r.employeeLastName}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{r.workDate}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.hours}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[r.status] ?? r.status}</td>
            </tr>
          ))}
          {overtimeRequests.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz fazla mesai talebi yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
