import { IntegrationError } from './errors';

// lib/e-document/provider.ts İLE AYNI desen, dört farklı dış sistem için.
// Hepsi BİLİNÇLİ OLARAK aynı ölçüde sığ (tek metotlu) — bu dört
// entegrasyonun HİÇBİRİ için gerçek bir donanım/protokol kararı henüz
// verilmedi (hangi PLC markası/Modbus mu OPC-UA mı, hangi RFID okuyucu,
// hangi LDAP/AD sunucusu, hangi banka API'si) — bu tek başına, bu fazın
// GERÇEK, dürüst kapsamı: karar verilene kadar sistemin bunlar olmadan
// çalışabilmesini sağlamak (madde metninin "abstraction" isteğinin
// TAMAMI bu — gerçek bir entegrasyon YAZMAK bu fazın kapsamı DEĞİL).

export interface DirectoryUser {
  externalId: string;
  email: string;
  fullName: string;
}

// LDAP/Active Directory — gelecekte SSO/dizin senkronizasyonu için.
export interface DirectoryProvider {
  readonly name: string;
  findUser(email: string): Promise<DirectoryUser | null>;
}

export class NullDirectoryProvider implements DirectoryProvider {
  readonly name = 'NONE';
  async findUser(): Promise<DirectoryUser | null> {
    throw new IntegrationError('LDAP/Dizin sağlayıcısı henüz yapılandırılmadı — TODO: DIRECTORY_PROVIDER_CREDENTIALS_REQUIRED.', false);
  }
}

export interface RfidReadEvent {
  tagId: string;
  readerId: string;
  readAt: Date;
}

// RFID — depo/varlık takibi için okuyucu donanımından canlı akış.
export interface RfidProvider {
  readonly name: string;
  readLatest(readerId: string): Promise<RfidReadEvent[]>;
}

export class NullRfidProvider implements RfidProvider {
  readonly name = 'NONE';
  async readLatest(): Promise<RfidReadEvent[]> {
    throw new IntegrationError('RFID sağlayıcısı henüz yapılandırılmadı — TODO: RFID_HARDWARE_REQUIRED.', false);
  }
}

export interface PlcTagValue {
  tag: string;
  value: number;
  readAt: Date;
}

// PLC/SCADA — lib/mes/downtime.ts'in KENDİ yorumunun (bkz. dosya başı)
// işaret ettiği, henüz kurulmamış donanım köprüsü.
export interface PlcProvider {
  readonly name: string;
  readTags(tags: string[]): Promise<PlcTagValue[]>;
}

export class NullPlcProvider implements PlcProvider {
  readonly name = 'NONE';
  async readTags(): Promise<PlcTagValue[]> {
    throw new IntegrationError('PLC/SCADA sağlayıcısı henüz yapılandırılmadı — TODO: PLC_PROTOCOL_REQUIRED (Modbus/OPC-UA/vb. seçimi bekleniyor).', false);
  }
}

export interface BankStatementLine {
  date: string;
  amount: number;
  description: string;
  counterAccount?: string;
}

// Banka — lib/bank.ts'in ZATEN yaptığı ELLE hareket girişinden AYRI:
// bankanın kendi API'si/MT940 dosyası üzerinden OTOMATİK ekstre çekimi.
export interface BankFeedProvider {
  readonly name: string;
  fetchStatement(bankAccountId: string, fromDate: string, toDate: string): Promise<BankStatementLine[]>;
}

export class NullBankFeedProvider implements BankFeedProvider {
  readonly name = 'NONE';
  async fetchStatement(): Promise<BankStatementLine[]> {
    throw new IntegrationError('Banka ekstre entegrasyonu henüz yapılandırılmadı — TODO: BANK_API_CREDENTIALS_REQUIRED. Elle hareket girişi için lib/bank.ts kullanılmaya devam eder.', false);
  }
}

export function resolveDirectoryProvider(_companyId: string): DirectoryProvider {
  return new NullDirectoryProvider();
}

export function resolveRfidProvider(_companyId: string): RfidProvider {
  return new NullRfidProvider();
}

export function resolvePlcProvider(_companyId: string): PlcProvider {
  return new NullPlcProvider();
}

export function resolveBankFeedProvider(_companyId: string): BankFeedProvider {
  return new NullBankFeedProvider();
}
