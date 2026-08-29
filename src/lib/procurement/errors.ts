// lib/it/errors.ts:ItError / lib/core/errors.ts:CoreError İLE AYNI sadelikte
// (madde 67). Procurement artık Faz 0'ın platform temelini TÜKETEN gerçek
// bir domain — CoreError'ı ÖDÜNÇ almak yerine kendi hata sınıfını hak
// ediyor (warehouse.ts'in AccountingError kullanımından FARKLI olarak, o
// Depo'nun muhasebeyle iç içeliğinden kaynaklanan özel bir durumdu).
export class ProcurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcurementError';
  }
}
