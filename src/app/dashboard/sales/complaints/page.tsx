import { requireSession } from '@/lib/dal';
import { listComplaints } from '@/lib/sales/complaints';
import { listParties } from '@/lib/master-data/parties';
import { CreateComplaintForm, ComplaintStatusButtons } from '@/components/sales/complaint-forms';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', IN_PROGRESS: 'İşleniyor', RESOLVED: 'Çözümlendi', CLOSED: 'Kapatıldı' };
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', CRITICAL: 'Kritik' };

export default async function ComplaintsPage() {
  const session = await requireSession();
  const [complaints, parties] = await Promise.all([listComplaints(session.companyId), listParties(session.companyId)]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Müşteri Şikayetleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Satış sonrası şikayet/talep takibi.</p>

      <div style={{ marginBottom: 20 }}><CreateComplaintForm parties={parties.map((p) => ({ id: p.id, legalName: p.legalName }))} /></div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Cari</th><th style={{ padding: '6px 8px' }}>Konu</th>
            <th style={{ padding: '6px 8px' }}>Öncelik</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--dim-border-soft)', verticalAlign: 'top' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.complaintNo}</td>
              <td style={{ padding: '6px 8px' }}>{c.partyName}</td>
              <td style={{ padding: '6px 8px' }}>{c.subject}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{PRIORITY_LABELS[c.priority] ?? c.priority}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{STATUS_LABELS[c.status] ?? c.status}</td>
              <td style={{ padding: '6px 8px' }}>{c.status !== 'CLOSED' ? <ComplaintStatusButtons complaintId={c.id} currentStatus={c.status} /> : null}</td>
            </tr>
          ))}
          {complaints.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz şikayet yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
