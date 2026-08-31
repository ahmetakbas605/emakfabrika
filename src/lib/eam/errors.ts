// lib/quality/errors.ts:QualityError İLE AYNI sadelikte — Holding ERP Faz 6
// (EAM + Enerji) kendi domain hatasını hak eden bağımsız bir modül.
export class EamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EamError';
  }
}
