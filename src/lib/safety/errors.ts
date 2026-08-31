// lib/environment/errors.ts:EnvironmentError İLE AYNI sadelikte — Holding
// ERP Faz 10 (İSG HR-dışı) kendi domain hatasını hak eden bağımsız modül.
export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyError';
  }
}
