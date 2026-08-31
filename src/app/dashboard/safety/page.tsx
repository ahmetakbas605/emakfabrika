import { requireSession } from '@/lib/dal';
import { listIncidents } from '@/lib/safety/incidents';
import { listEmployees } from '@/lib/hr/employees';
import { CreateIncidentForm, StartIncidentInvestigationButton, CloseIncidentForm } from '@/components/safety/safety-forms';

const INCIDENT_TYPE_LABELS: Record<string, string> = { ACCIDENT: 'Kaza', NEAR_MISS: 'Ramak Kala', OCCUPATIONAL_ILLNESS: 'Meslek Hastalığı' };
const SEVERITY_LABELS: Record<string, string> = { MINOR: 'Hafif', MODERATE: 'Orta', SEVERE: 'Ağır', FATAL: 'Ölümcül' };
const STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', INVESTIGATING: 'Soruşturuluyor', CLOSED: 'Kapatıldı' };

export default async function SafetyPage() {
  const session = await requireSession();
  const [incidents, employees] = await Promise.all([listIncidents(session.companyId), listEmployees(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İSG — Olay/Kaza Kaydı</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Eğitim/PDKS zaten İK modülünde tutuluyor — bu sayfa yalnızca HR-dışı olay/kaza kayıtlarını kapsar. Çevre kayıtları için <a href="/dashboard/environment">ayrı sayfa</a>.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Olay Kaydı Oluştur</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateIncidentForm employees={employees.map((e) => ({ id: e.id, fullName: `${e.firstName} ${e.lastName}` }))} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Olaylar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Önem</th>
            <th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Çalışan</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{i.incidentNo}</td>
              <td style={{ padding: '6px 8px' }}>{INCIDENT_TYPE_LABELS[i.incidentType]}</td>
              <td style={{ padding: '6px 8px', color: i.severity === 'FATAL' || i.severity === 'SEVERE' ? '#b00' : '#666' }}>{SEVERITY_LABELS[i.severity]}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{i.incidentDate}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{i.employeeName ? `${i.employeeName} ${i.employeeLastName}` : '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[i.status]}</td>
              <td style={{ padding: '6px 8px' }}>
                {i.status === 'OPEN' ? <StartIncidentInvestigationButton incidentId={i.id} /> : null}
                {i.status === 'INVESTIGATING' ? <CloseIncidentForm incidentId={i.id} /> : null}
              </td>
            </tr>
          ))}
          {incidents.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Henüz olay kaydı yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
