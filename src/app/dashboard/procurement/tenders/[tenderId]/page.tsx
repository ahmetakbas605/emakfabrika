import { requireSession } from '@/lib/dal';
import { getTender } from '@/lib/procurement/tender';
import { PublishTenderButton, CancelTenderButton } from '@/components/procurement/tender-form';

const TENDER_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', PUBLISHED: 'Yayınlandı', CANCELLED: 'İptal' };
const SUPPLIER_STATUS_LABEL: Record<string, string> = { INVITED: 'Davet Edildi', RESPONDED: 'Teklif Verdi', DECLINED: 'Reddetti' };

export default async function TenderDetailPage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  const session = await requireSession();
  const { tender, lines, suppliers } = await getTender(session.companyId, tenderId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{tender.tenderNo} — {tender.title}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {TENDER_STATUS_LABEL[tender.status] ?? tender.status}
        {tender.bidSubmissionDeadline ? ` · Teklif son tarihi: ${new Date(tender.bidSubmissionDeadline).toLocaleString('tr-TR')}` : ''}
        {tender.bidOpeningAt ? ` · Açılış: ${new Date(tender.bidOpeningAt).toLocaleString('tr-TR')}` : ''}
        {tender.deliveryLocation ? ` · Teslimat: ${tender.deliveryLocation}` : ''}
        {tender.openParticipation ? ' · Açık katılım' : ' · Davetli katılım'}
        {tender.bidBondRequired ? ` · Teminat: ${tender.bidBondPercent ? `%${tender.bidBondPercent}` : ''}${tender.bidBondAmount ? ` ${Number(tender.bidBondAmount).toLocaleString('tr-TR')}` : ''}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tender.status === 'DRAFT' ? <PublishTenderButton tenderId={tenderId} /> : null}
        {tender.status !== 'CANCELLED' ? <CancelTenderButton tenderId={tenderId} /> : null}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kalemler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Açıklama</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Miktar</th>
            <th style={{ padding: '6px 8px' }}>Birim</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{l.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(l.quantity).toLocaleString('tr-TR')}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{l.unitCode}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Davetli Tedarikçiler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Tedarikçi</th>
            <th style={{ padding: '6px 8px' }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{s.supplierName}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{SUPPLIER_STATUS_LABEL[s.status] ?? s.status}</td>
            </tr>
          ))}
          {suppliers.length === 0 && !tender.openParticipation ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Davetli tedarikçi yok.</td></tr> : null}
          {tender.openParticipation ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Açık katılım — herhangi bir tedarikçi kendi teklifini vererek katılabilir (Faz 8B).</td></tr> : null}
        </tbody>
      </table>

      <p style={{ color: '#999', fontSize: 12 }}>Kapalı teklif toplama ve açılış (Faz 8B) henüz uygulanmadı.</p>
    </div>
  );
}
