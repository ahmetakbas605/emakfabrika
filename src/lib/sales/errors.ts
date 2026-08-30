// lib/procurement/errors.ts:ProcurementError İLE AYNI sadelikte (madde 67) —
// Satış & CRM (Holding ERP Faz 1) kendi domain hatasını hak eden bağımsız
// bir modül.
export class SalesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesError';
  }
}
