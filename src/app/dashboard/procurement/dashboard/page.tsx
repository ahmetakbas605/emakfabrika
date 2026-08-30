import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listUserDepartmentAccess } from '@/lib/permissions';
import { getRequisitionStatusBreakdown, getMyPendingProcurementApprovalsCount, getProcurementPipelineStats, getTopSupplierSpend } from '@/lib/procurement/dashboard';

const REQUEST_STATUS_LABEL: Record<string, string> = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', REVISION_REQUIRED: 'Revizyon Gerekli', CANCELLED: 'İptal' };

function Card({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 14, minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', color: '#111' }}>{inner}</Link> : inner;
}

export default async function ProcurementDashboardPage() {
  const session = await requireSession();

  // Talep bazlı görünürlük EMAK-FABRIKA'nın kendi departman-bazlı erişim
  // modeliyle (lib/dal.ts:requireDepartmentAccess) TUTARLI: fabrika
  // yöneticisi şirket geneli görür, diğerleri yalnızca ERİŞTİKLERİ
  // departmanlar + KENDİ talepleri.
  const scope = session.isFactoryAdmin ? ('ALL' as const) : { departmentIds: (await listUserDepartmentAccess(session.id)).map((a) => a.departmentId) };

  const [breakdown, pendingApprovals] = await Promise.all([
    getRequisitionStatusBreakdown(session.companyId, scope, session.id),
    getMyPendingProcurementApprovalsCount(session.companyId, session.id)
  ]);

  // Bölüm C (RFQ/Ödül/Sipariş/Fatura seviyesi) şirket geneli — bir RFQ
  // birden fazla departmanın talebini birleştirebildiği için (madde 49-50)
  // TEK bir departmana anlamlı şekilde süzülemez, yalnızca fabrika
  // yöneticisine gösterilir.
  const [pipeline, topSuppliers] = session.isFactoryAdmin
    ? await Promise.all([getProcurementPipelineStats(session.companyId), getTopSupplierSpend(session.companyId)])
    : [null, []];

  const breakdownMap = new Map(breakdown.map((b) => [b.status, b.count]));

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Satınalma Kontrol Paneli</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        {session.isFactoryAdmin ? 'Şirket geneli görünüm.' : 'Erişiminiz olan departmanlar ve kendi talepleriniz.'}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <Card label="Bekleyen Onaylarım" value={pendingApprovals} href="/dashboard/approvals" />
        {Object.entries(REQUEST_STATUS_LABEL).map(([status, label]) => (
          <Card key={status} label={label} value={breakdownMap.get(status) ?? 0} href="/dashboard/procurement" />
        ))}
      </div>

      {pipeline ? (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Satınalma Boru Hattı</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            <Card label="Kuyrukta (RFQ Bekleyen) Kalem" value={pipeline.queueLineCount} href="/dashboard/procurement/rfqs" />
            <Card label="Açık RFQ (Teklif Bekleniyor)" value={pipeline.openRfqCount} href="/dashboard/procurement/rfqs" />
            <Card label="Onay Bekleyen Ödül" value={pipeline.awardsPendingApprovalCount} href="/dashboard/approvals" />
            <Card label="Teslim Bekleyen Sipariş" value={pipeline.posAwaitingReceiptCount} />
            <Card label="Onay Bekleyen Fatura" value={pipeline.draftInvoiceCount} />
          </div>

          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tedarikçi Bazlı Harcama (Top 5, Onaylanmış Faturalar)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, maxWidth: 480 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                <th style={{ padding: '6px 8px' }}>Tedarikçi</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Toplam Harcama</th>
              </tr>
            </thead>
            <tbody>
              {topSuppliers.map((s) => (
                <tr key={s.supplierPartyId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{s.supplierName}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(s.totalSpend).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {topSuppliers.length === 0 ? <tr><td colSpan={2} style={{ padding: '8px', color: '#999' }}>Henüz onaylanmış fatura yok.</td></tr> : null}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
