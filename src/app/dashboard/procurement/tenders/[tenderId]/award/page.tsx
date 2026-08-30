import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/dal';
import { getTender } from '@/lib/procurement/tender';
import { getTenderEvaluation } from '@/lib/procurement/evaluation';
import { getAwardByTender } from '@/lib/procurement/award';
import { ProcurementError } from '@/lib/procurement/errors';
import { TenderAwardCreateForm, type TenderAwardLineOption } from '@/components/procurement/tender-award-form';

export default async function TenderAwardPage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  const session = await requireSession();

  const existing = await getAwardByTender(session.companyId, tenderId);
  if (existing) redirect(`/dashboard/procurement/awards/${existing.id}`);

  const [{ tender, lines }, { rows }] = await Promise.all([getTender(session.companyId, tenderId), getTenderEvaluation(session.companyId, tenderId)]);
  if (tender.status !== 'OPENED') throw new ProcurementError('Yalnızca teklifleri açılmış (OPENED) bir ihale için ödül oluşturulabilir.');

  const evalByLine = new Map(rows.map((r) => [r.tenderLineId, r]));
  const awardLines: TenderAwardLineOption[] = lines.map((line) => {
    const evalRow = evalByLine.get(line.id);
    const cells = (evalRow?.cells ?? []).filter((c) => c.tenderBidLineId !== null).map((c) => ({ supplierPartyId: c.supplierPartyId, supplierName: c.supplierName, tenderBidLineId: c.tenderBidLineId as string, weightedTotal: c.weightedTotal }));
    return { tenderLineId: line.id, description: line.description, quantity: line.quantity, unitCode: line.unitCode, cells };
  });

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{tender.tenderNo} — Ödül Oluştur</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        Ağırlıklı skora göre en yüksek skorlu tedarikçi varsayılan olarak önerilir — miktarı bölerek birden fazla tedarikçiye ödül verebilirsiniz.
      </p>
      <TenderAwardCreateForm tenderId={tenderId} lines={awardLines} />
    </div>
  );
}
