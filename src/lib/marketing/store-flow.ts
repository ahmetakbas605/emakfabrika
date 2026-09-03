// Mağaza vardiyasının SAF kuralları — DB'ye de ağa da dokunmaz
// (weighing-math.ts / contract-flow.ts ile AYNI gerekçe: test edilebilir
// olmalı, çünkü bu kurallar muhasebeye giden tutarı belirliyor).

export type MarketingStoreType = 'POS' | 'ORDER_INTAKE';
export type MarketingStoreShiftStatus = 'OPEN' | 'CLOSED';

// Yalnızca POS türü mağaza kendi stok/kasasını tutar. ORDER_INTAKE
// yalnızca sipariş alır, vardiya/satış kavramı ona uygulanmaz.
export function requiresOwnLedger(storeType: MarketingStoreType): boolean {
  return storeType === 'POS';
}

// Satış, ancak AÇIK bir vardiya varken ve mağaza POS türündeyken
// kaydedilebilir. Kapalı vardiyada satış kaydı, o günün toplamını
// hesaplanmış (ve muhasebeye aktarılmış) bir kapanıştan SONRA sessizce
// değiştirir — bu yüzden engellenir.
export function canRecordSale(storeType: MarketingStoreType, shiftStatus: MarketingStoreShiftStatus | null): boolean {
  return storeType === 'POS' && shiftStatus === 'OPEN';
}

// Aynı mağazada aynı anda İKİ açık vardiya olamaz — iki kasiyer aynı
// kasayı aynı anda "açık" sanıp birbirinin satışını göremez.
export function canOpenShift(hasOpenShift: boolean): boolean {
  return !hasOpenShift;
}

export function canCloseShift(status: MarketingStoreShiftStatus): boolean {
  return status === 'OPEN';
}

// Satış kalemlerinin toplamı — kalemler ADET x BİRİM FİYAT. Sayıya
// çevrilemeyen bir kalem toplamı SESSİZCE 0 saymaz, null döner; çağıran
// bunu "hesaplanamadı" olarak ele almalı (contract-flow.ts:contractTotal
// ile AYNI disiplin, kasaya giden tutar hatalı hesaplanmasın diye).
export function saleLinesTotal(lines: { quantity: string | number; unitPrice: string | number }[]): number | null {
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    total += qty * price;
  }
  return Number(total.toFixed(6));
}

// Bir vardiyanın kapanış toplamı — o vardiyaya ait satışların toplamı.
// Boş vardiya (hiç satış yapılmamış gün) 0 döner, hata DEĞİL — kapatmak
// hâlâ geçerli bir işlem (mağaza o gün açık ama hiç satış olmamış olabilir).
export function shiftCloseTotal(saleTotals: (string | number)[]): number {
  return Number(saleTotals.reduce((sum: number, t) => sum + Number(t), 0).toFixed(6));
}
