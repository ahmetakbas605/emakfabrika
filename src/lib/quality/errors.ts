// lib/mes/errors.ts:MesError İLE AYNI sadelikte — Holding ERP Faz 5 (Kalite)
// kendi domain hatasını hak eden bağımsız bir modül.
export class QualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QualityError';
  }
}
