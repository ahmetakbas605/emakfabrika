// lib/eam/errors.ts:EamError İLE AYNI sadelikte — Holding ERP Faz 7 (Filo)
// kendi domain hatasını hak eden bağımsız bir modül.
export class FleetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetError';
  }
}
