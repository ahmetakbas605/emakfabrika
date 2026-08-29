import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { networkCredentials } from '@/db/schema';
import { newId } from '@/lib/id';
import { encryptSecret, parseHexKey } from '@/lib/crypto';
import { ItError } from '@/lib/it/errors';

// IT-SECURITY.md §1 — encryptedSecret bu dosyanın DIŞINA asla düz metin
// olarak çıkmaz; listCredentials/getCredentialMeta gibi TÜM okuma
// fonksiyonları bu alanı AÇIKÇA select listesinden hariç tutar (SELECT *
// KULLANILMAZ).
function getKey(): Buffer {
  const key = parseHexKey(process.env.IT_CREDENTIALS_ENC_KEY, 'IT_CREDENTIALS_ENC_KEY');
  if (!key) throw new ItError('IT_CREDENTIALS_ENC_KEY tanımlı değil — .env dosyasını kontrol edin.');
  return key;
}

export interface StoreCredentialInput {
  assetId?: string;
  credentialType: (typeof networkCredentials.$inferInsert)['credentialType'];
  label: string;
  secret: string;
}

export async function storeCredential(companyId: string, input: StoreCredentialInput): Promise<string> {
  const id = newId();
  const encryptedSecret = encryptSecret(input.secret, getKey());
  await db.insert(networkCredentials).values({ id, companyId, assetId: input.assetId, credentialType: input.credentialType, label: input.label, encryptedSecret });
  return id;
}

// Sır ASLA döner değil — yalnızca meta veri (ne zaman, hangi tip, hangi
// varlık için tanımlı) bir kimlik bilgisinin gerçekten kullanılacağı yerde
// (ör. bir gün gerçek bir NetworkDiscoveryAdapter implementasyonu),
// decryptSecret'ı DOĞRUDAN bu dosya İÇİNDE çağıran ayrı, dar-yetkili bir
// fonksiyon eklenecek — bugün hiçbir çağıran yok (Null adapter), o yüzden
// decrypt yolu bilinçli olarak YAZILMADI (kullanılmayan kod, madde 87).
export async function listCredentials(companyId: string) {
  return db
    .select({ id: networkCredentials.id, assetId: networkCredentials.assetId, credentialType: networkCredentials.credentialType, label: networkCredentials.label, createdAt: networkCredentials.createdAt })
    .from(networkCredentials)
    .where(eq(networkCredentials.companyId, companyId));
}
