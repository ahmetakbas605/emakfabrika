import { requireDepartmentAccess, listCompanyUsers } from '@/lib/dal';
import { getTicket, getTicketTimeline, listTicketAssignments, TICKET_TRANSITIONS } from '@/lib/it/tickets';
import { listTicketEscalations } from '@/lib/it/escalation';
import { TicketTransitionForm } from '@/components/it/ticket-transition-form';
import { TicketAssignForm } from '@/components/it/ticket-assign-form';
import { TicketCommentForm } from '@/components/it/ticket-comment-form';
import { TicketWorkLogForm } from '@/components/it/ticket-worklog-form';
import { ReopenTicketForm } from '@/components/it/reopen-ticket-form';
import { TicketAiAssistant } from '@/components/it/ticket-ai-assistant';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni', TRIAGED: 'Triyaj Edildi', ASSIGNED: 'Atandı', ACCEPTED: 'Kabul Edildi',
  ON_THE_WAY: 'Yolda', ARRIVED: 'Vardı', INSPECTION: 'İnceleme', WORKING: 'Çalışılıyor',
  WAITING: 'Beklemede', TESTING: 'Test Ediliyor', RESOLVED: 'Çözüldü',
  USER_APPROVAL_PENDING: 'Kullanıcı Onayı Bekliyor', CLOSED: 'Kapatıldı'
};

export default async function TicketDetailPage({ params }: { params: Promise<{ departmentId: string; ticketId: string }> }) {
  const { departmentId, ticketId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [ticket, timeline, assignments, companyUsers, escalations] = await Promise.all([
    getTicket(session.companyId, ticketId),
    getTicketTimeline(ticketId),
    listTicketAssignments(ticketId),
    listCompanyUsers(session.companyId),
    listTicketEscalations(ticketId)
  ]);

  const nextStatuses = TICKET_TRANSITIONS[ticket.status] ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{ticket.ticketNo} — {ticket.title}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>{ticket.category || 'Kategorisiz'} · {ticket.priority} · Talep eden: {ticket.requestedByName}</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4 }}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
        {ticket.slaDueAt ? <span style={{ color: '#666', fontSize: 13 }}>SLA: {new Date(ticket.slaDueAt).toLocaleString('tr-TR')}</span> : null}
        {escalations.length > 0 ? <span style={{ color: '#b00', fontSize: 13, fontWeight: 600 }}>Eskale edildi — Seviye {escalations[0].level} ({escalations[0].roleName ?? escalations[0].escalatedToRoleCode})</span> : null}
      </div>

      {ticket.description ? <p style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>{ticket.description}</p> : null}

      <TicketAiAssistant departmentId={departmentId} ticketId={ticketId} />

      {access.permissions.update && ticket.status !== 'CLOSED' ? (
        <div style={{ marginBottom: 16 }}>
          <TicketTransitionForm departmentId={departmentId} ticketId={ticketId} nextStatuses={nextStatuses} />
        </div>
      ) : null}

      {access.permissions.approve && ticket.status === 'CLOSED' ? (
        <div style={{ marginBottom: 16 }}>
          <ReopenTicketForm departmentId={departmentId} ticketId={ticketId} />
        </div>
      ) : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Atamalar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kullanıcı</th>
            <th style={{ padding: '6px 8px' }}>Rol</th>
            <th style={{ padding: '6px 8px' }}>Atandı</th>
            <th style={{ padding: '6px 8px' }}>Ayrıldı</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{a.userName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.role === 'LEADER' ? 'Sorumlu' : 'Yardımcı'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(a.assignedAt).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{a.unassignedAt ? new Date(a.unassignedAt).toLocaleString('tr-TR') : '—'}</td>
            </tr>
          ))}
          {assignments.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz atama yok.</td></tr> : null}
        </tbody>
      </table>
      {access.permissions.assign ? <div style={{ marginBottom: 24 }}><TicketAssignForm departmentId={departmentId} ticketId={ticketId} users={companyUsers} /></div> : null}

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Zaman Çizelgesi</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {timeline.map((e, i) => (
          <div key={i} style={{ fontSize: 13, borderLeft: '2px solid #ddd', paddingLeft: 10 }}>
            <span style={{ color: '#999', fontSize: 11 }}>{new Date(e.at).toLocaleString('tr-TR')}</span>
            {e.kind === 'STATUS_CHANGE' ? <p>{e.byName}: <b>{STATUS_LABELS[e.fromStatus] ?? e.fromStatus}</b> → <b>{STATUS_LABELS[e.toStatus] ?? e.toStatus}</b>{e.note ? ` — ${e.note}` : ''}</p> : null}
            {e.kind === 'COMMENT' ? <p>{e.byName} ({e.isInternal ? 'iç not' : 'yorum'}): {e.body}</p> : null}
            {e.kind === 'WORK_LOG' ? <p>{e.byName}: {e.minutesSpent} dk iş kaydı{e.note ? ` — ${e.note}` : ''}</p> : null}
          </div>
        ))}
        {timeline.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Henüz kayıt yok.</p> : null}
      </div>

      {access.permissions.update ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TicketCommentForm departmentId={departmentId} ticketId={ticketId} />
          <TicketWorkLogForm departmentId={departmentId} ticketId={ticketId} />
        </div>
      ) : null}
    </div>
  );
}
