import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listProcurementQueue, listRfqs } from '@/lib/procurement/rfq';
import { listUnits } from '@/lib/master-data/units';
import { listParties } from '@/lib/master-data/parties';
import { RfqCreateForm } from '@/components/procurement/rfq-create-form';

const RFQ_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SENT: 'Gönderildi', CLOSED: 'Kapandı', CANCELLED: 'İptal' };

export default async function RfqsPage() {
  const session = await requireSession();
  const [rfqs, queueItems, units, suppliers] = await Promise.all([
    listRfqs(session.companyId),
    listProcurementQueue(session.companyId),
    listUnits(session.companyId),
    listParties(session.companyId, { role: 'SUPPLIER' })
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>RFQ (Teklif Talebi)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Onaylanmış talep satırları (Procurement Queue) veya doğrudan kalemlerle tedarikçilere teklif talebi gönderin.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th>
            <th style={{ padding: '6px 8px' }}>Başlık</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
            <th style={{ padding: '6px 8px' }}>Son Teklif Tarihi</th>
          </tr>
        </thead>
        <tbody>
          {rfqs.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}><Link href={`/dashboard/procurement/rfqs/${r.id}`}>{r.rfqNo}</Link></td>
              <td style={{ padding: '6px 8px' }}>{r.title}</td>
              <td style={{ padding: '6px 8px' }}>{RFQ_STATUS_LABEL[r.status] ?? r.status}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{r.quotationDeadline ? new Date(r.quotationDeadline).toLocaleString('tr-TR') : '—'}</td>
            </tr>
          ))}
          {rfqs.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: '#999' }}>Henüz RFQ yok.</td></tr> : null}
        </tbody>
      </table>

      {units.length === 0 ? (
        <p style={{ color: '#b00', fontSize: 13 }}>Önce Master Data → Birimler'de en az bir birim tanımlanmalı.</p>
      ) : (
        <RfqCreateForm
          queueItems={queueItems.map((q) => ({ lineId: q.lineId, requestNo: q.requestNo, description: q.description, quantity: q.purchaseQty ?? q.quantity, unitId: q.unitId, unitCode: q.unitCode, productId: q.productId }))}
          units={units.map((u) => ({ id: u.id, code: u.code }))}
          suppliers={suppliers.map((s) => ({ id: s.id, legalName: s.legalName }))}
        />
      )}
    </div>
  );
}
