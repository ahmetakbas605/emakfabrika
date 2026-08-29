// MEVZUAT-MAP.md §3 — Adapter Pattern. Kullanıcının notu: "bu tip fabrikalar
// da tüm entegrasyonlar e-fatura e defter gibi vb tek firmadan alınır" —
// yani BİR fabrikanın e-Fatura/e-Arşiv/e-İrsaliye/e-Defter/e-Beyanname
// entegrasyonlarının HEPSİ aynı özel entegratörden gelir (emakerp/
// emakelektron'daki SmartDönüşüm gibi, tek sağlayıcı — birden fazla
// entegratör arasında seçim YOK, bu proje kapsamında).
//
// Bu arayüz, o TEK sağlayıcının gerçek kimlik bilgileri/SDK'sı elimize
// geçtiğinde (bkz. TODO altında) yalnızca BİR sınıfın (ör.
// SmartDonusumProvider) yazılmasını gerektirir — ACCOUNTING-ENGINE.md'nin
// geri kalanı (fatura üretim akışı, muhasebe fişi) HİÇ değişmez.
//
// TODO: SUPPLIER_CREDENTIALS_REQUIRED — hangi entegratör, hangi kimlik
// bilgileriyle kullanılacağı henüz belirtilmedi. NullElectronicDocumentProvider
// bu netleşene kadar sistemin GERÇEK bir GİB bağlantısı olmadan da
// çalışabilmesini sağlıyor (her çağrıda açık, anlaşılır bir hata fırlatır —
// sessizce "başarılı" gibi davranmaz).

export interface PreparedDocument {
  documentId: string;
  xml: string;
  uuid: string;
}

export interface SendResult {
  status: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ERROR';
  etn?: string;
  errorMessage?: string;
}

export interface StatusResult {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  lastCheckedAt: Date;
}

export interface CancelResult {
  cancelled: boolean;
  errorMessage?: string;
}

export interface InvoiceForEDocument {
  journalId: string;
  companyId: string;
  invoiceNo: string;
  invoiceDate: string;
  buyerTaxId: string;
  buyerName: string;
  lines: { description: string; quantity: string; unitPrice: string; vatRate: string }[];
}

// PDF (Muhasebe) madde 19-20, IT PDF'in "tek firmadan alınır" notuyla
// birleştirilmiş — TEK bir sağlayıcı sınıfı bu arayüzü uygular.
export interface ElectronicDocumentProvider {
  readonly name: string;
  prepareInvoice(invoice: InvoiceForEDocument): Promise<PreparedDocument>;
  send(document: PreparedDocument): Promise<SendResult>;
  queryStatus(documentId: string): Promise<StatusResult>;
  cancel(documentId: string): Promise<CancelResult>;
}

export class ElectronicDocumentError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ElectronicDocumentError';
  }
}

// Gerçek entegratör kimlik bilgileri netleşene kadar kullanılan varsayılan —
// AÇIKÇA reddeder, asla "gönderildi gibi davranmaz" (finansal veri
// doğruluğunun görsel tamlıktan önce geldiği ilkesiyle tutarlı).
export class NullElectronicDocumentProvider implements ElectronicDocumentProvider {
  readonly name = 'NONE';

  async prepareInvoice(): Promise<PreparedDocument> {
    throw new ElectronicDocumentError('e-Belge sağlayıcısı henüz yapılandırılmadı — TODO: SUPPLIER_CREDENTIALS_REQUIRED.', false);
  }
  async send(): Promise<SendResult> {
    throw new ElectronicDocumentError('e-Belge sağlayıcısı henüz yapılandırılmadı.', false);
  }
  async queryStatus(): Promise<StatusResult> {
    throw new ElectronicDocumentError('e-Belge sağlayıcısı henüz yapılandırılmadı.', false);
  }
  async cancel(): Promise<CancelResult> {
    throw new ElectronicDocumentError('e-Belge sağlayıcısı henüz yapılandırılmadı.', false);
  }
}

// Şirket başına HANGİ sağlayıcının kullanılacağını döndürür — bugün her
// zaman NullElectronicDocumentProvider (gerçek sağlayıcı seçildiğinde bu
// fonksiyon içine bir "if" eklenecek, çağıran kod DEĞİŞMEYECEK).
export function resolveElectronicDocumentProvider(_companyId: string): ElectronicDocumentProvider {
  return new NullElectronicDocumentProvider();
}
