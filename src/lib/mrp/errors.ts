// lib/production/errors.ts:ProductionError İLE AYNI sadelikte (madde 67) —
// Holding ERP Faz 3 (MRP) kendi domain hatasını hak eden bağımsız bir modül.
export class MrpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MrpError';
  }
}
