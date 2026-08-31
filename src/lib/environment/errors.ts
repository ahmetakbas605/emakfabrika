// lib/legal/errors.ts:LegalError İLE AYNI sadelikte — Holding ERP Faz 10
// (Çevre) kendi domain hatasını hak eden bağımsız bir modül.
export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}
