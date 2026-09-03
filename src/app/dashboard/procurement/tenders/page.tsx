import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listTenders } from '@/lib/procurement/tender';
import { listUnits } from '@/lib/master-data/units';
import { listParties } from '@/lib/master-data/parties';
import { TenderCreateForm } from '@/components/procurement/tender-form';

const TENDER_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', PUBLISHED: 'Yayınlandı', CANCELLED: 'İptal' };

export default async function TendersPage() {
  const session = await requireSession();
  const [tenders, units, suppliers] = await Promise.all([
    listTenders(session.companyId),
    listUnits(session.companyId),
    listParties(session.companyId, { role: 'SUPPLIER' })
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>İhaleler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Kapalı zarf teklif toplayan resmi ihale süreçleri. Teklif içeriği, açılış anına kadar gizli tutulur.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>No</th>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Teklif Son Tarihi</th>
            <th style={{ padding: '6px 8px' }}>Açılış</th>
          </tr>
        </thead>
        <tbody>
          {tenders.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/procurement/tenders/${t.id}`}>{t.tenderNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{t.title}</td>
              <td style={{ padding: '6px 8px' }}>{TENDER_STATUS_LABEL[t.status] ?? t.status}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.bidSubmissionDeadline ? new Date(t.bidSubmissionDeadline).toLocaleString('tr-TR') : '—'}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{t.bidOpeningAt ? new Date(t.bidOpeningAt).toLocaleString('tr-TR') : '—'}</td>
            </tr>
          ))}
          {tenders.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz ihale yok.</td></tr> : null}
        </tbody>
      </table>

      {units.length === 0 ? (
        <p style={{ color: 'var(--dim-danger)', fontSize: 13 }}>Önce Master Data → Birimler&apos;de en az bir birim tanımlanmalı.</p>
      ) : (
        <TenderCreateForm units={units.map((u) => ({ id: u.id, code: u.code }))} suppliers={suppliers.map((s) => ({ id: s.id, legalName: s.legalName }))} />
      )}
    </div>
  );
}
