// lib/sales/errors.ts:SalesError ile AYNI sadelikte (madde 67) — Pazarlama
// (Kantar / Ofis-Mağaza / Satış Sözleşmesi) kendi domain hatasını hak eden
// bağımsız bir modül.
export class MarketingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketingError';
  }
}
