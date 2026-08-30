import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { getTender, listTenderBidParticipation, getTenderBidComparison } from '@/lib/procurement/tender';
import { getAwardByTender } from '@/lib/procurement/award';
import { listParties } from '@/lib/master-data/parties';
import { PublishTenderButton, CancelTenderButton } from '@/components/procurement/tender-form';
import { TenderBidForm, OpenTenderBiddingButton } from '@/components/procurement/tender-bid-form';

const TENDER_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', PUBLISHED: 'Yayınlandı', OPENED: 'Teklifler Açıldı', AWARDED: 'Ödüllendirildi', CANCELLED: 'İptal' };
const SUPPLIER_STATUS_LABEL: Record<string, string> = { INVITED: 'Davet Edildi', RESPONDED: 'Teklif Verdi', DECLINED: 'Reddetti' };

export default async function TenderDetailPage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  const session = await requireSession();
  const { tender, lines, suppliers } = await getTender(session.companyId, tenderId);

  const [participation, award] = await Promise.all([
    listTenderBidParticipation(session.companyId, tenderId),
    getAwardByTender(session.companyId, tenderId)
  ]);
  const canSeeComparison = tender.status === 'OPENED' || tender.status === 'AWARDED';
  const comparison = canSeeComparison ? await getTenderBidComparison(session.companyId, tenderId) : [];

  const bidSuppliers = tender.openParticipation ? await listParties(session.companyId, { role: 'SUPPLIER' }) : suppliers.map((s) => ({ id: s.supplierPartyId, legalName: s.supplierName }));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{tender.tenderNo} — {tender.title}</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {TENDER_STATUS_LABEL[tender.status] ?? tender.status}
        {tender.bidSubmissionDeadline ? ` · Teklif son tarihi: ${new Date(tender.bidSubmissionDeadline).toLocaleString('tr-TR')}` : ''}
        {tender.bidOpeningAt ? ` · Planlanan açılış: ${new Date(tender.bidOpeningAt).toLocaleString('tr-TR')}` : ''}
        {tender.openedAt ? ` · Gerçek açılış: ${new Date(tender.openedAt).toLocaleString('tr-TR')}` : ''}
        {tender.deliveryLocation ? ` · Teslimat: ${tender.deliveryLocation}` : ''}
        {tender.openParticipation ? ' · Açık katılım' : ' · Davetli katılım'}
        {tender.bidBondRequired ? ` · Teminat: ${tender.bidBondPercent ? `%${tender.bidBondPercent}` : ''}${tender.bidBondAmount ? ` ${Number(tender.bidBondAmount).toLocaleString('tr-TR')}` : ''}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tender.status === 'DRAFT' ? <PublishTenderButton tenderId={tenderId} /> : null}
        {tender.status === 'PUBLISHED' ? <OpenTenderBiddingButton tenderId={tenderId} /> : null}
        {tender.status !== 'CANCELLED' && tender.status !== 'AWARDED' ? <CancelTenderButton tenderId={tenderId} /> : null}
        {canSeeComparison ? <Link href={`/dashboard/procurement/tenders/${tenderId}/evaluate`} style={{ display: 'inline-block', padding: '7px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Değerlendirme</Link> : null}
        {award ? (
          <Link href={`/dashboard/procurement/awards/${award.id}`} style={{ display: 'inline-block', padding: '7px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Ödülü Görüntüle</Link>
        ) : tender.status === 'OPENED' ? (
          <Link href={`/dashboard/procurement/tenders/${tenderId}/award`} style={{ display: 'inline-block', padding: '7px 14px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#111' }}>Ödül Oluştur</Link>
        ) : null}
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

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{tender.openParticipation ? 'Katılımcılar' : 'Davetli Tedarikçiler'}</h2>
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
          {suppliers.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Henüz katılımcı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teklif Katılımı</h2>
      <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Kim teklif verdi — içerik (fiyat/miktar) açılışa kadar gizlidir.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {participation.map((p) => (
          <span key={p.supplierPartyId} style={{ fontSize: 12, border: '1px solid #eee', borderRadius: 4, padding: '4px 8px' }}>{p.supplierName} (v{p.version})</span>
        ))}
        {participation.length === 0 ? <span style={{ color: '#999', fontSize: 13 }}>Henüz teklif yok.</span> : null}
      </div>

      {tender.status === 'PUBLISHED' ? (
        <div style={{ marginBottom: 24 }}>
          <TenderBidForm tenderId={tenderId} tenderLines={lines.map((l) => ({ id: l.id, description: l.description }))} suppliers={bidSuppliers.map((s) => ({ id: s.id, legalName: s.legalName }))} />
        </div>
      ) : null}

      {canSeeComparison ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Teklif Karşılaştırması</h2>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Her tedarikçinin EN SON teklif versiyonu kullanılır, en ucuzdan pahalıya sıralanır. Ağırlıklı skor için Değerlendirme sayfasına bakın.</p>
          {comparison.map((row) => (
            <div key={row.tenderLineId} style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{row.description} ({Number(row.quantity).toLocaleString('tr-TR')})</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                    <th style={{ padding: '4px 8px' }}>Tedarikçi</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Birim Fiyat</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>İndirim</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Net Birim</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>Toplam</th>
                    <th style={{ padding: '4px 8px' }}>Teslim</th>
                  </tr>
                </thead>
                <tbody>
                  {row.cells.map((c, i) => (
                    <tr key={c.supplierPartyId} style={{ borderBottom: '1px solid #f0f0f0', background: i === 0 ? '#f4fbf4' : undefined }}>
                      <td style={{ padding: '4px 8px' }}>{c.supplierName}{c.isAlternative ? ' (Alternatif)' : ''}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{c.unitPrice}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>%{c.discountPercent}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{c.netUnitPrice}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: i === 0 ? 600 : 400 }}>{c.lineTotal}</td>
                      <td style={{ padding: '4px 8px', color: '#666' }}>{c.deliveryDays ?? '—'} gün</td>
                    </tr>
                  ))}
                  {row.cells.length === 0 ? <tr><td colSpan={6} style={{ padding: '6px 8px', color: '#999' }}>Bu kalem için teklif yok.</td></tr> : null}
                </tbody>
              </table>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
