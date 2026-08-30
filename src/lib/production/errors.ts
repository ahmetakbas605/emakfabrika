// lib/sales/errors.ts:SalesError İLE AYNI sadelikte (madde 67) — Holding ERP
// Faz 2 (Üretim Çekirdeği) kendi domain hatasını hak eden bağımsız bir modül.
export class ProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionError';
  }
}
