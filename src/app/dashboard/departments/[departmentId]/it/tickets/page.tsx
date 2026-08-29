import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { listTickets, listSlaPolicies } from '@/lib/it/tickets';
import { listAssets } from '@/lib/it/assets';
import { TicketForm } from '@/components/it/ticket-form';
import { SlaPolicyForm } from '@/components/it/sla-policy-form';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni', TRIAGED: 'Triyaj Edildi', ASSIGNED: 'Atandı', ACCEPTED: 'Kabul Edildi',
  ON_THE_WAY: 'Yolda', ARRIVED: 'Vardı', INSPECTION: 'İnceleme', WORKING: 'Çalışılıyor',
  WAITING: 'Beklemede', TESTING: 'Test Ediliyor', RESOLVED: 'Çözüldü',
  USER_APPROVAL_PENDING: 'Kullanıcı Onayı Bekliyor', CLOSED: 'Kapatıldı'
};

export default async function TicketsPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);
  const [tickets, assets, slaPolicies] = await Promise.all([listTickets(session.companyId), listAssets(session.companyId), listSlaPolicies(session.companyId)]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ticketlar</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Durum makinesi SERVICE-DESK.md §1'de tanımlı — geçersiz bir geçiş her zaman reddedilir.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Kategori</th>
            <th style={{ padding: '6px 8px' }}>Öncelik</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Talep Eden</th>
            <th style={{ padding: '6px 8px' }}>SLA Süresi</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/departments/${departmentId}/it/tickets/${t.id}`}>{t.ticketNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{t.title}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{t.category || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{t.priority}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[t.status] ?? t.status}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{t.requestedByName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{t.slaDueAt ? new Date(t.slaDueAt).toLocaleString('tr-TR') : '—'}</td>
            </tr>
          ))}
          {tickets.length === 0 ? <tr><td colSpan={7} style={{ padding: '8px', color: '#999' }}>Henüz ticket yok.</td></tr> : null}
        </tbody>
      </table>

      {access.permissions.create ? <div style={{ marginBottom: 24 }}><TicketForm departmentId={departmentId} assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))} /></div> : null}

      {access.permissions.configure ? (
        <div>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>SLA Politikaları</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                <th style={{ padding: '6px 8px' }}>Ad</th>
                <th style={{ padding: '6px 8px' }}>Öncelik</th>
                <th style={{ padding: '6px 8px' }}>Yanıt (dk)</th>
                <th style={{ padding: '6px 8px' }}>Çözüm (saat)</th>
              </tr>
            </thead>
            <tbody>
              {slaPolicies.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{p.name}</td>
                  <td style={{ padding: '6px 8px' }}>{p.priority}</td>
                  <td style={{ padding: '6px 8px' }}>{p.responseMinutes}</td>
                  <td style={{ padding: '6px 8px' }}>{p.resolutionHours}</td>
                </tr>
              ))}
              {slaPolicies.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz SLA politikası yok — ticket oluşturulunca SLA süresi hesaplanmaz.</td></tr> : null}
            </tbody>
          </table>
          <SlaPolicyForm departmentId={departmentId} />
        </div>
      ) : null}
    </div>
  );
}
