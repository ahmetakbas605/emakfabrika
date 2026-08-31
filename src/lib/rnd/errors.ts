// lib/safety/errors.ts:SafetyError İLE AYNI sadelikte — Holding ERP
// Faz 10 (Ar-Ge) kendi domain hatasını hak eden bağımsız bir modül.
export class RndError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RndError';
  }
}
