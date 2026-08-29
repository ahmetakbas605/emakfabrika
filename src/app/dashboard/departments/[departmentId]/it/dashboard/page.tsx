import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { getItDashboardSummary } from '@/lib/it/dashboard';
import { globalSearch } from '@/lib/it/search';

const TICKET_STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni', TRIAGED: 'Triyaj Edildi', ASSIGNED: 'Atandı', ACCEPTED: 'Kabul Edildi',
  ON_THE_WAY: 'Yolda', ARRIVED: 'Vardı', INSPECTION: 'İnceleme', WORKING: 'Çalışılıyor',
  WAITING: 'Beklemede', TESTING: 'Test Ediliyor', RESOLVED: 'Çözüldü', USER_APPROVAL_PENDING: 'Onay Bekliyor'
};

function Card({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 16, minWidth: 140 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: danger && Number(value) > 0 ? '#b00' : '#111' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}

export default async function ItDashboardPage({ params, searchParams }: { params: Promise<{ departmentId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { departmentId } = await params;
  const { q } = await searchParams;
  const { session } = await requireDepartmentAccess(departmentId);
  const [summary, searchResult] = await Promise.all([getItDashboardSummary(session.companyId), q ? globalSearch(session.companyId, q) : Promise.resolve(null)]);

  const totalOpenTickets = summary.openTicketsByStatus.reduce((sum, s) => sum + s.count, 0);
  const totalAssets = summary.assetsByStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>IT Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Tüm sayılar var olan tablolardan canlı hesaplanır — ayrı bir rapor tablosu yok.</p>

      <form method="get" style={{ marginBottom: 20 }}>
        <input name="q" defaultValue={q} placeholder="Varlık, ticket veya IP ara (192.168.1.25 gibi)..." style={{ padding: 8, width: 340 }} />
        <button type="submit" style={{ padding: '8px 16px', marginLeft: 8, cursor: 'pointer' }}>Ara</button>
      </form>

      {searchResult ? (
        <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 13 }}>
          <b>Arama Sonuçları — &quot;{q}&quot;</b>
          {searchResult.ip ? (
            <p style={{ marginTop: 8 }}>IP: <b>{searchResult.ip.ipAddress}</b> — {searchResult.ip.status} — subnet {searchResult.ip.subnetCidr}{searchResult.ip.assetTag ? ` — ${searchResult.ip.assetTag} (${searchResult.ip.assetName})` : ''}{searchResult.ip.vlanNumber ? ` — VLAN ${searchResult.ip.vlanNumber}` : ''}</p>
          ) : null}
          {searchResult.assets.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <b>Varlıklar:</b>
              <ul>{searchResult.assets.map((a) => <li key={a.id}>{a.assetTag} — {a.name}</li>)}</ul>
            </div>
          ) : null}
          {searchResult.tickets.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <b>Ticketlar:</b>
              <ul>{searchResult.tickets.map((t) => <li key={t.id}><Link href={`/dashboard/departments/${departmentId}/it/tickets/${t.id}`}>{t.ticketNo}</Link> — {t.title}</li>)}</ul>
            </div>
          ) : null}
          {!searchResult.ip && searchResult.assets.length === 0 && searchResult.tickets.length === 0 ? <p style={{ marginTop: 8, color: '#999' }}>Sonuç bulunamadı.</p> : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <Card label="Açık Ticket" value={totalOpenTickets} />
        <Card label="Açık Incident" value={summary.openIncidentsCount} danger />
        <Card label="Açık Alert" value={summary.openAlertsCount} danger />
        <Card label="Toplam Varlık" value={totalAssets} />
        <Card label="Uyumsuz Varlık" value={summary.nonCompliantAssetsCount} danger />
        <Card label="Yaklaşan Lisans Bitişi" value={summary.expiringLicensesCount} />
        <Card label="Yaklaşan Garanti Bitişi" value={summary.expiringWarrantiesCount} />
        <Card label="Yaklaşan Sözleşme Bitişi" value={summary.expiringContractsCount} />
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Durum Bazında Açık Ticketlar</h2>
      <table style={{ width: '100%', maxWidth: 400, borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <tbody>
          {summary.openTicketsByStatus.map((s) => <tr key={s.status} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '4px 8px' }}>{TICKET_STATUS_LABELS[s.status] ?? s.status}</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{s.count}</td></tr>)}
          {summary.openTicketsByStatus.length === 0 ? <tr><td style={{ padding: '4px 8px', color: '#999' }}>Açık ticket yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Durum Bazında Varlıklar</h2>
      <table style={{ width: '100%', maxWidth: 400, borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {summary.assetsByStatus.map((s) => <tr key={s.status} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '4px 8px' }}>{s.status}</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{s.count}</td></tr>)}
          {summary.assetsByStatus.length === 0 ? <tr><td style={{ padding: '4px 8px', color: '#999' }}>Henüz varlık yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
