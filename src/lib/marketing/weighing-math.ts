// Kantarın SAF hesaplama kuralları — veritabanına da ağa da dokunmaz.
//
// Bilinçli olarak `server-only` İÇERMEZ: bu kurallar faturaya giden
// miktarı belirlediği için test edilebilir olmaları şart, ve testin
// Next.js istek bağlamı dışında çalışması gerekiyor.
// (emakerp/src/lib/network-reach.ts ile AYNI gerekçe.)

// Net = Brüt − Dara. Hangisinin önce okunduğu sahada değişir: araç dolu
// girip boş çıkabilir ya da boş girip dolu çıkabilir. Bu yüzden SIRA
// değil, iki değerin kendisi önemlidir.
export function computeNetKg(grossKg?: string | number | null, tareKg?: string | number | null): number | null {
  if (grossKg == null || tareKg == null) return null;
  const gross = Number(grossKg);
  const tare = Number(tareKg);
  if (!Number.isFinite(gross) || !Number.isFinite(tare)) return null;
  const net = gross - tare;
  return Number.isFinite(net) ? Number(net.toFixed(3)) : null;
}

// Karayolları tonaj kontrolü — BRÜT (yüklü araç) sınırla karşılaştırılır,
// net değil. Kullanıcının kuralı: adetli üründe bile bu fiş kesilir.
// Limit tanımlı değilse kontrol YAPILAMAZ; false değil null döner —
// "bilinmiyor" ile "aşım var" karıştırılmamalı.
export function checkRoadLegal(grossKg?: string | number | null, limitKg?: string | number | null): boolean | null {
  if (grossKg == null || limitKg == null) return null;
  const gross = Number(grossKg);
  const limit = Number(limitKg);
  if (!Number.isFinite(gross) || !Number.isFinite(limit) || limit <= 0) return null;
  return gross <= limit;
}

// Ürün birimi kg değilse siparişteki miktar kg'ye çevrilir. Çarpan
// tanımlı değilse TAHMİN YÜRÜTÜLMEZ, null döner ve ekranda "birim
// çevrimi yok" uyarısı çıkar — yanlış bir kg değeri üretip faturayı
// bozmaktansa eksik bilgi göstermek yeğdir.
export function toKg(quantity: string | number, unitCode: string | null, conversionFactor: string | number | null): number | null {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) return null;
  if (unitCode != null && unitCode.trim().toUpperCase() === 'KG') return Number(qty.toFixed(3));
  if (conversionFactor == null) return null;
  const factor = Number(conversionFactor);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return Number((qty * factor).toFixed(3));
}

export interface ToleranceVerdict {
  remainingKg: number | null;
  isOverDelivered: boolean;
  withinTolerance: boolean | null;
}

// "talep / şu anki / eksik" ekranının kararı.
// tolerancePercent 0 = tolerans kapalı -> withinTolerance null (karar yok,
// yalnızca sayılar gösterilir). Kullanıcı: "ileride belli bir tolerans
// tanımlanabilir".
export function evaluateFulfilment(
  requestedKg: number | null,
  deliveredKg: number,
  tolerancePercent: number
): ToleranceVerdict {
  if (requestedKg == null) {
    return { remainingKg: null, isOverDelivered: false, withinTolerance: null };
  }
  const remainingKg = Number((requestedKg - deliveredKg).toFixed(3));
  const isOverDelivered = remainingKg < 0;

  if (!(tolerancePercent > 0) || requestedKg <= 0) {
    return { remainingKg, isOverDelivered, withinTolerance: null };
  }
  const allowed = (requestedKg * tolerancePercent) / 100;
  return { remainingKg, isOverDelivered, withinTolerance: Math.abs(remainingKg) <= allowed };
}
