// lib/it/errors.ts:ItError İLE AYNI sadelikte (madde 67 — gereksiz
// abstraction oluşturma) — Master Data (Party/Product/Currency/Unit/Fiyat
// Listesi) Muhasebe/Depo/IT'nin HİÇBİRİNE ait değil, kendi hata sınıfını
// hak ediyor (warehouse.ts'in AccountingError'ı ÖDÜNÇ ALMASından farklı
// olarak — o, Depo'nun muhasebeyle iç içe geçmişliğinden kaynaklanan özel
// bir durumdu, Master Data'nın böyle bir gerekçesi yok).
export class CoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoreError';
  }
}
