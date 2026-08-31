// lib/rnd/errors.ts:RndError İLE AYNI sadelikte — Holding ERP Faz 11
// (Hazine Genişletme) kendi domain hatasını hak eden bağımsız bir modül.
export class TreasuryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TreasuryError';
  }
}
