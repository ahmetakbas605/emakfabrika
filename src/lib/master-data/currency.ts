import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { currencies, exchangeRates } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb, type MoneyInput } from '@/lib/money';
import { CoreError } from '@/lib/core/errors';

// currencies company_id TAŞIMAZ (ISO 4217 evrensel — bkz. schema.ts yorumu).
// Bu yüzden listCurrencies companyId ALMAZ, tüm diğer lib fonksiyonlarından
// FARKLI — bilinçli bir istisna, tenant izolasyonu ihlali DEĞİL (global
// referans verisi, companies/roles/permissions İLE AYNI kategori).
export async function listCurrencies() {
  return db.select().from(currencies).where(eq(currencies.active, true));
}

export interface RecordExchangeRateInput {
  currencyCode: string;
  rateDate: string;
  rate: MoneyInput;
  rateType?: 'BUY' | 'SELL' | 'EFFECTIVE' | 'CENTRAL_BANK' | 'CUSTOM';
  source?: string;
}

export async function recordExchangeRate(input: RecordExchangeRateInput): Promise<string> {
  const [currency] = await db.select({ code: currencies.code }).from(currencies).where(eq(currencies.code, input.currencyCode)).limit(1);
  if (!currency) throw new CoreError('Para birimi bulunamadı.');

  const id = newId();
  await db.insert(exchangeRates).values({
    id,
    currencyCode: input.currencyCode,
    rateDate: input.rateDate,
    rate: toDb(input.rate),
    rateType: input.rateType ?? 'EFFECTIVE',
    source: input.source
  });
  return id;
}

export async function listExchangeRates(currencyCode?: string) {
  const conditions = currencyCode ? eq(exchangeRates.currencyCode, currencyCode) : undefined;
  return db.select().from(exchangeRates).where(conditions).orderBy(desc(exchangeRates.rateDate)).limit(200);
}

// En son (rateDate'e göre) kaydı döner — belirli bir tarih için TARİHSEL bir
// sorgu DEĞİL (o, Faz 2B/2C'nin gerçek ihtiyacı netleşince eklenecek).
export async function getLatestExchangeRate(currencyCode: string, rateType: 'BUY' | 'SELL' | 'EFFECTIVE' | 'CENTRAL_BANK' | 'CUSTOM' = 'EFFECTIVE') {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.currencyCode, currencyCode), eq(exchangeRates.rateType, rateType)))
    .orderBy(desc(exchangeRates.rateDate))
    .limit(1);
  return row ?? null;
}
