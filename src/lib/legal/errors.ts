// lib/projects/errors.ts:ProjectError İLE AYNI sadelikte — Holding ERP
// Faz 9 (Hukuk + Risk) kendi domain hatasını hak eden bağımsız bir modül.
export class LegalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegalError';
  }
}
