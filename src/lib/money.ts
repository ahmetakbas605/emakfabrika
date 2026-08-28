import Decimal from 'decimal.js';

// PDF madde 43: "JavaScript number kullanarak para hesaplama yapma... floating
// point hatası oluşmasına izin verme." Tüm para hesapları BU dosyadan geçer —
// hiçbir yerde ham `+`/`-`/`*` ile decimal/string tutarlar toplanmaz. DB'de
// DECIMAL(20,6) sütunları drizzle tarafından STRING olarak döner (kayıp
// yaşanmasın diye) — bu modül o string'leri Decimal'e çevirip işler, geri
// DB'ye yazarken yine string'e (sabit 6 ondalık) döner.
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

export function money(value: MoneyInput): Decimal {
  return new Decimal(value ?? 0);
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(money(v)), new Decimal(0));
}

// DB'ye yazılacak DECIMAL(20,6) string'i — her zaman 6 ondalık basamak.
export function toDb(value: MoneyInput): string {
  return money(value).toFixed(6);
}

// Ekranda gösterilecek TRY/USD/... metni — 2 ondalık, TR yerel biçimi.
export function toDisplay(value: MoneyInput, currency: 'TRY' | 'USD' | 'EUR' | 'GBP' = 'TRY'): string {
  const symbol = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[currency];
  const num = money(value).toDecimalPlaces(2).toNumber();
  return `${symbol}${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isZero(value: MoneyInput): boolean {
  return money(value).isZero();
}

export function equals(a: MoneyInput, b: MoneyInput): boolean {
  return money(a).equals(money(b));
}
