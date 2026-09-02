import { IntegrationError } from './errors';

// lib/e-document/provider.ts İLE AYNI "arayüz + dürüst Null implementasyon"
// deseni — Email/SMS sağlayıcısının GERÇEK kimlik bilgileri/SDK'sı
// (hangi sağlayıcı — SendGrid/Twilio/Netgsm/vb.) henüz belirtilmedi
// (TODO: NOTIFICATION_PROVIDER_CREDENTIALS_REQUIRED). Null implementasyon
// her çağrıda açık, anlaşılır bir hata fırlatır — sessizce "gönderildi
// gibi" davranmaz. lib/integration/events.ts:dispatchEvent bu hatayı
// YAKALAR (bir bildirim başarısızlığı asla ana iş akışını bozmaz).

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendSmsInput {
  to: string;
  message: string;
}

export interface NotificationResult {
  sent: boolean;
  providerMessageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<NotificationResult>;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SendSmsInput): Promise<NotificationResult>;
}

export class NullEmailProvider implements EmailProvider {
  readonly name = 'NONE';
  async send(): Promise<NotificationResult> {
    throw new IntegrationError('E-posta sağlayıcısı henüz yapılandırılmadı — TODO: NOTIFICATION_PROVIDER_CREDENTIALS_REQUIRED.', false);
  }
}

export class NullSmsProvider implements SmsProvider {
  readonly name = 'NONE';
  async send(): Promise<NotificationResult> {
    throw new IntegrationError('SMS sağlayıcısı henüz yapılandırılmadı — TODO: NOTIFICATION_PROVIDER_CREDENTIALS_REQUIRED.', false);
  }
}

// Şirket başına HANGİ sağlayıcının kullanılacağını döndürür — bugün her
// zaman Null (gerçek sağlayıcı seçildiğinde bu fonksiyonların içine bir
// "if" eklenecek, çağıran kod DEĞİŞMEYECEK — e-document'in AYNI deseni).
export function resolveEmailProvider(_companyId: string): EmailProvider {
  return new NullEmailProvider();
}

export function resolveSmsProvider(_companyId: string): SmsProvider {
  return new NullSmsProvider();
}
