import { requireFactoryAdmin } from '@/lib/dal';
import { getScoringWeights } from '@/lib/procurement/evaluation';
import { ScoringWeightsForm } from '@/components/procurement/evaluation-form';

export default async function ScoringWeightsPage() {
  const session = await requireFactoryAdmin();
  const weights = await getScoringWeights(session.companyId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Skorlama Ağırlıkları</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Teklif değerlendirmesinde fiyat/teknik/teslimat/ticari bileşenlerin ağırlıklı ortalamadaki payı. Toplam %100 olmalı.</p>
      <ScoringWeightsForm weights={weights} />
    </div>
  );
}
