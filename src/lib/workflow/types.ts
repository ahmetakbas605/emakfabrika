// SATINALMA-MİMARİSİ Faz 0 — genel workflow motorunun sözleşmesi. Bu
// dosyada 'procurement' kelimesi GEÇMEZ — documentType çağıran domain
// tarafından belirlenir (ör. 'PROCUREMENT_REQUISITION'), motor bunu
// tanımıyor, yalnızca eşleştiriyor.

// madde 32 — kuralın hangi kriterlere göre eşleşeceği. Hepsi opsiyonel;
// boş bir conditions objesi "her zaman eşleşir" (catch-all kural) anlamına
// gelir. minAmount/maxAmount dahil (>=/<=) aralık olarak yorumlanır.
export interface WorkflowConditions {
  minAmount?: number;
  maxAmount?: number;
  categoryCode?: string;
  costCenterId?: string;
  capexOpex?: 'CAPEX' | 'OPEX';
  departmentId?: string;
}

export type WorkflowApproverType = 'POSITION' | 'SPECIFIC_USER' | 'MANAGER_CHAIN';

// Bir onay zincirinin TEK adımı. approverType'a göre approverValue'nun
// anlamı değişir:
//   POSITION       -> positions.id (o pozisyondaki TÜM aktif kullanıcılar)
//   SPECIFIC_USER  -> users.id (tek kullanıcı)
//   MANAGER_CHAIN  -> "N" (talebi başlatanın yönetici zincirinde N.
//                     seviye — "1" = doğrudan yöneticisi, "2" = onun
//                     yöneticisi, vb.)
// mode: bu adıma birden fazla onaylayan çözümlenirse (ör. POSITION'da o
// pozisyonda 3 kişi varsa) hepsi mi gerekli (SEQUENTIAL — pratikte "AND",
// isim onay ZİNCİRİNİN kendisinin sıralı olmasından geliyor, adım İÇİ
// anlamı "hepsi") yoksa quorum kadarı mı yeterli (PARALLEL + quorum).
export interface WorkflowChainStep {
  approverType: WorkflowApproverType;
  approverValue: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  quorum?: number;
}

export interface WorkflowContext {
  amount?: number;
  categoryCode?: string;
  costCenterId?: string;
  capexOpex?: 'CAPEX' | 'OPEX';
  departmentId?: string;
}
