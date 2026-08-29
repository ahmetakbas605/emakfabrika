import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/dal';
import { getRfq } from '@/lib/procurement/rfq';
import { getRfqEvaluation } from '@/lib/procurement/evaluation';
import { getAwardByRfq } from '@/lib/procurement/award';
import { ProcurementError } from '@/lib/procurement/errors';
import { AwardCreateForm, type AwardLineOption } from '@/components/procurement/award-form';

export default async function RfqAwardPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const session = await requireSession();

  const existing = await getAwardByRfq(session.companyId, rfqId);
  if (existing) redirect(`/dashboard/procurement/awards/${existing.id}`);

  const [{ rfq, lines }, { rows }] = await Promise.all([getRfq(session.companyId, rfqId), getRfqEvaluation(session.companyId, rfqId)]);
  if (rfq.status !== 'CLOSED') throw new ProcurementError('Yalnızca teklif toplama kapatılmış (CLOSED) bir RFQ için ödül oluşturulabilir.');

  const evalByLine = new Map(rows.map((r) => [r.rfqLineId, r]));
  const awardLines: AwardLineOption[] = lines.map((line) => {
    const evalRow = evalByLine.get(line.id);
    const cells = (evalRow?.cells ?? []).filter((c) => c.quotationLineId !== null).map((c) => ({ supplierPartyId: c.supplierPartyId, supplierName: c.supplierName, quotationLineId: c.quotationLineId as string, weightedTotal: c.weightedTotal }));
    return { rfqLineId: line.id, description: line.description, quantity: line.quantity, unitCode: line.unitCode, cells };
  });

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{rfq.rfqNo} — Ödül Oluştur</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        Faz 3&apos;ün ağırlıklı skoruna göre en yüksek skorlu tedarikçi varsayılan olarak önerilir — miktarı bölerek birden fazla tedarikçiye ödül verebilirsiniz.
      </p>
      <AwardCreateForm rfqId={rfqId} lines={awardLines} />
    </div>
  );
}
