import { requireDepartmentAccess } from '@/lib/dal';
import { listIncidents } from '@/lib/it/incidents';
import { listTickets } from '@/lib/it/tickets';
import { IncidentForm } from '@/components/it/incident-form';
import { IncidentStatusForm } from '@/components/it/incident-status-form';
import { LinkTicketIncidentForm } from '@/components/it/link-ticket-incident-form';

export default async function IncidentsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [incidents, tickets] = await Promise.all([listIncidents(session.companyId), listTickets(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Incidentlar</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Birden fazla ticket bir incident'a bağlanabilir (SERVICE-DESK.md §5).</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Önem</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Açan</th>
            <th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{i.title}</td>
              <td style={{ padding: '6px 8px' }}>{i.severity}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{i.status}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{i.openedByName}</td>
              <td style={{ padding: '6px 8px' }}>{access.permissions.update ? <IncidentStatusForm departmentId={departmentId} incidentId={i.id} currentStatus={i.status} /> : null}</td>
            </tr>
          ))}
          {incidents.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz incident yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <div style={{ marginBottom: 16 }}><IncidentForm departmentId={departmentId} /></div> : null}
      {access.permissions.update && incidents.length > 0 ? (
        <LinkTicketIncidentForm departmentId={departmentId} incidents={incidents.map((i) => ({ id: i.id, title: i.title }))} tickets={tickets.map((t) => ({ id: t.id, ticketNo: t.ticketNo, title: t.title }))} />
      ) : null}
    </div>
  );
}
