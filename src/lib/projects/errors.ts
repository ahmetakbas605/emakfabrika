// lib/fleet/errors.ts:FleetError İLE AYNI sadelikte — Holding ERP Faz 8
// (Proje Yönetimi) kendi domain hatasını hak eden bağımsız bir modül.
export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectError';
  }
}
