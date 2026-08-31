import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listInspections } from '@/lib/quality/inspections';
import { listNcrs } from '@/lib/quality/ncr';
import { listIncomingInspectionSources, listInProcessInspectionSources, listFinalInspectionSources } from '@/lib/quality/sources';
import { listProducts } from '@/lib/master-data/products';
import { listParties } from '@/lib/master-data/parties';
import { RecordInspectionForm, CreateNcrForm } from '@/components/quality/quality-forms';

const RESULT_LABELS: Record<string, string> = { PASS: 'Kabul', CONDITIONAL: 'Şartlı Kabul', FAIL: 'Ret' };
const TYPE_LABELS: Record<string, string> = { INCOMING: 'Giriş', IN_PROCESS: 'Proses', FINAL: 'Final' };
const SEVERITY_LABELS: Record<string, string> = { MINOR: 'Düşük', MAJOR: 'Orta', CRITICAL: 'Kritik' };
const NCR_STATUS_LABELS: Record<string, string> = { OPEN: 'Açık', INVESTIGATING: 'Soruşturuluyor', CORRECTIVE_ACTION: 'Düzeltici Faaliyet', VERIFICATION: 'Doğrulama', CLOSED: 'Kapalı', REJECTED: 'Reddedildi' };

export default async function QualityPage() {
  const session = await requireSession();
  const [inspections, ncrs, incomingSources, processSources, finalSources, products, suppliers] = await Promise.all([
    listInspections(session.companyId), listNcrs(session.companyId),
    listIncomingInspectionSources(session.companyId), listInProcessInspectionSources(session.companyId), listFinalInspectionSources(session.companyId),
    listProducts(session.companyId), listParties(session.companyId, { role: 'SUPPLIER' })
  ]);

  const incomingInspections = inspections.filter((i) => i.type === 'INCOMING');
  const incomingPassRate = incomingInspections.length > 0 ? (incomingInspections.filter((i) => i.result === 'PASS').length / incomingInspections.length) * 100 : null;
  const openNcrs = ncrs.filter((n) => n.status !== 'CLOSED' && n.status !== 'REJECTED');
  const openBySeverity = { MINOR: 0, MAJOR: 0, CRITICAL: 0 } as Record<string, number>;
  for (const n of openNcrs) openBySeverity[n.severity]++;
  const failedInspections = inspections.filter((i) => i.result === 'FAIL');

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Kalite (Giriş/Proses/Final Muayene + NCR/CAPA)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Muayene sonuçları Satınalma'nın mal kabul kayıtlarına ve Üretim'in operasyon/emirlerine bağlanır. Tedarikçi kalite skoru <Link href="#tedarikci">aşağıda</Link>, cari bazlı hesaplanır.</p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Giriş Muayene Kabul Oranı" value={incomingPassRate === null ? '—' : `%${incomingPassRate.toFixed(1)}`} big />
        <Stat label="Açık NCR — Düşük" value={String(openBySeverity.MINOR)} />
        <Stat label="Açık NCR — Orta" value={String(openBySeverity.MAJOR)} />
        <Stat label="Açık NCR — Kritik" value={String(openBySeverity.CRITICAL)} />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Muayene Kaydet</h2>
      <div style={{ marginBottom: 24 }}>
        <RecordInspectionForm
          incomingSources={incomingSources.map((s) => ({ id: s.id, receiptNo: s.receiptNo, description: s.description, receivedQty: s.receivedQty, supplierName: s.supplierName }))}
          processSources={processSources.map((s) => ({ id: s.id, name: s.name, orderNo: s.orderNo, productName: s.productName }))}
          finalSources={finalSources.map((s) => ({ id: s.id, orderNo: s.orderNo, productName: s.productName, quantity: s.quantity }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
        />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Son Muayeneler</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px' }}>Ürün</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Muayene</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Geçen</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Ret</th>
            <th style={{ padding: '6px 8px' }}>Sonuç</th><th style={{ padding: '6px 8px' }}>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {inspections.slice(0, 20).map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{i.inspectionNo}</td>
              <td style={{ padding: '6px 8px' }}>{TYPE_LABELS[i.type]}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{i.productName ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{i.inspectedQty}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{i.passedQty}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{i.failedQty}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: i.result === 'FAIL' ? '#b00' : i.result === 'CONDITIONAL' ? '#a60' : '#080' }}>{RESULT_LABELS[i.result]}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(i.inspectedAt).toLocaleString('tr-TR')}</td>
            </tr>
          ))}
          {inspections.length === 0 ? <tr><td colSpan={8} style={{ padding: '8px', color: '#999' }}>Henüz muayene kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>NCR Oluştur (Uygunsuzluk Kaydı)</h2>
      <div style={{ marginBottom: 24 }}>
        <CreateNcrForm
          failedInspections={failedInspections.map((i) => ({ id: i.id, inspectionNo: i.inspectionNo, productName: i.productName }))}
          suppliers={suppliers.map((s) => ({ id: s.id, legalName: s.legalName }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
        />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>NCR Listesi</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>No</th><th style={{ padding: '6px 8px' }}>Başlık</th><th style={{ padding: '6px 8px' }}>Tedarikçi</th>
            <th style={{ padding: '6px 8px' }}>Önem</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {ncrs.map((n) => (
            <tr key={n.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{n.ncrNo}</td>
              <td style={{ padding: '6px 8px' }}>{n.title}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{n.supplierName ?? '—'}</td>
              <td style={{ padding: '6px 8px', color: n.severity === 'CRITICAL' ? '#b00' : n.severity === 'MAJOR' ? '#a60' : '#666' }}>{SEVERITY_LABELS[n.severity]}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{NCR_STATUS_LABELS[n.status]}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/quality/ncr/${n.id}`}>Detay →</Link></td>
            </tr>
          ))}
          {ncrs.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz NCR kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 id="tedarikci" style={{ fontSize: 15, marginBottom: 8 }}>Tedarikçi Kalite</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Tedarikçi</th><th style={{ padding: '6px 8px' }}></th></tr></thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{s.legalName}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/quality/suppliers/${s.id}`}>Kalite Skoru →</Link></td>
            </tr>
          ))}
          {suppliers.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Henüz SUPPLIER rolünde cari kartı yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', minWidth: 110 }}>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}
