// IT-ARCHITECTURE.md §2 — tam hata hiyerarşisi (BusinessError/ValidationError/
// vb., PDF madde 80) yalnızca GERÇEKTEN gerektiğinde (dış entegrasyon
// yüzeyleri — Faz 11+ network/monitoring) genişletilecek. Bugün, Muhasebe'nin
// AccountingError'ıyla AYNI sadelikte tek bir sınıf yeterli (madde 67:
// gereksiz abstraction oluşturma).
export class ItError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItError';
  }
}
