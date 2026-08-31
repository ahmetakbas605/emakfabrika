// lib/production/errors.ts:ProductionError İLE AYNI sadelikte (madde 67) —
// Holding ERP Faz 4 (MES) kendi domain hatasını hak eden bağımsız bir modül.
export class MesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MesError';
  }
}
