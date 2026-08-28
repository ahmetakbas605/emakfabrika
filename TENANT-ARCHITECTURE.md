# TENANT-ARCHITECTURE.md

## 1. İki seviyeli kiracılık modeli

PDF'in kendi tarif ettiği hiyerarşi (`PLATFORM → TENANT → COMPANY → BRANCH →
WAREHOUSE → USER`) klasik **paylaşımlı-şema** multi-tenancy varsayıyor (tek DB,
`tenant_id` sütunuyla ayrım — emakerp'in modeli). Kullanıcının açık kararı bunun
YERİNE **database-per-tenant** (kiracı-başına fiziksel DB) — bu da tanınmış,
üretimde yaygın bir multi-tenancy deseni, sadece emakerp'ten farklı bir tanesi.
Sonuç: hiyerarşi iki seviyeye ayrılıyor:

```
DIŞ SEVİYE (fiziksel izolasyon)
  Fabrika/Holding  ──►  kendi MySQL veritabanı, kendi emakfabrika dağıtımı
                        ("tenant" burada = bir MySQL DB + bir uygulama örneği)

İÇ SEVİYE (o fabrikanın KENDİ veritabanı içinde, uygulama-katmanı izolasyon)
  Company (şirket, holding çoklu şirket barındırabilir)
    └─ Branch (şube)
         └─ Department (Muhasebe, Satış, Stok/Depo, İK, Üretim, ...)
              └─ User
```

Bir "tenant_id" sütunu emakfabrika'nın tablolarında YOKTUR — çünkü her DB zaten
tek bir fabrikaya ait. Bunun yerine iç seviyede `company_id`/`branch_id`/
`department_id` var (PDF madde 5'in "company_id/branch_id/warehouse_id" isteğiyle
örtüşüyor, yalnızca en üstteki `tenant_id` fiziksel DB sınırına devrediliyor).

## 2. Bir fabrika = bir veya birden çok şirket (holding senaryosu)

Kullanıcı "holding bazlı departman bazlı" dedi — bir holding altında birden
fazla şirket olabilir, ama HEPSİ AYNI fiziksel MySQL'i paylaşır (holding tek bir
"fabrika anlaşması" kiracısıdır). Bu, PDF'in Company/Branch ayrımıyla tam
örtüşüyor: `company` tablosu 1 veya N satır olabilir, her biri kendi
issuer/vergi kimliğini (VKN, vergi dairesi — ayrı tüzel kişilik olabileceği
için) taşır, ama muhasebe hesap planı gibi bazı yapılar company-başına mı yoksa
holding-genelinde mi paylaşılacağı **kullanıcıya sorulması gereken açık bir
karar** — `TODO: HOLDING_ACCOUNT_PLAN_SCOPE` (tek hesap planı mı, şirket başına
ayrı mı — gerçek muhasebe pratiğinde genelde şirket başına ayrı defter/hesap
planı olur, konsolide raporlama ayrı bir katmandır).

## 3. Departman modeli

PDF'in kendi cümlesi: "Supervisor fabrika seçeneğini seçerse kurulumda departman
bazlı modüller görünecek." Yani `department` bir organizasyonel birim OLMANIN
yanında, aynı zamanda **hangi modüllerin bu fabrikada aktif olduğunu** belirleyen
birim: her department bir `department_type` taşır (`ACCOUNTING`, `SALES`,
`WAREHOUSE`, `HR`, `PRODUCTION`, ... — PDF'ler geldikçe genişleyecek bir enum,
kod içine sabit gömülmeyecek, `department_types` referans tablosu). Bir
kullanıcı bir veya birden fazla departmana atanabilir (`user_department_access`
ara tablosu) — PDF madde 40'taki rol matrisi (ACCOUNTING_MANAGER, SALES_USER,
WAREHOUSE_MANAGER vb.) departman ataması ile kesişiyor: rol "ne yapabilir"i,
departman ataması "nerede yapabilir"i belirler.

Mobil/masaüstü ayrımı da departman bazlı: kullanıcı hangi departmanların Android/
iOS uygulaması alacağını henüz belirtmedi ("onlarla oraya gelince neleri
görecekler anlatacağım") — bu MOBILE-ARCHITECTURE.md'ye (ileride, ilgili
departman PDF'i geldiğinde) bırakıldı.

## 4. Muhasebe modu (Ön Muhasebe / Tam Muhasebe)

PDF madde 57 — `accounting_mode` (`PRE_ACCOUNTING` | `FULL_ACCOUNTING`) fabrika
seviyesinde mi yoksa company seviyesinde mi tanımlanmalı? Karar: **company
seviyesinde** — bir holding altındaki bir şirket sadece ön muhasebe kullanırken
diğeri tam muhasebe (SMMM entegrasyonlu) kullanabilir, gerçekçi bir senaryo.

## 5. Üretimde provizyon modeli

Gerçek üretimde (bugünkü test kurulumu DEĞİL) her fabrika "kendi bünyesinde
sunucuda tutar" — yani emakfabrika'nın bir örneği fiziksel olarak o fabrikanın
kendi sunucusunda/veri merkezinde çalışacak, EM-AK'ın merkezi altyapısında değil.
Bu, iki gerçek operasyonel soruyu açık bırakıyor (kullanıcıya sorulmalı, burada
tahmin edilmeyecek):

- `TODO: DEPLOYMENT_MODEL` — kod dağıtımı nasıl olacak? (a) Her fabrikaya
  elle/Docker imajıyla kurulum, EM-AK uzaktan bakım yapar, (b) her fabrika kendi
  IT'siyle kurar, EM-AK yalnızca lisans/güncelleme sağlar, (c) hibrit. Bu,
  sürüm güncelleme stratejisini (emakadroid'in OTA modeline benzer bir mekanizma
  mı, yoksa elle mi) doğrudan etkiliyor.
- `TODO: CENTRAL_REGISTRY` — EM-AK'ın "kaç fabrika var, hangileri hangi sürümde,
  lisans süresi ne zaman bitiyor" gibi bir merkezi görünürlüğü olacak mı (emakerp'in
  `/platform` panelindeki gibi)? Fiziksel izolasyon ilkesiyle çelişmeden (yani
  fabrika VERİSİNE erişmeden, yalnızca "ayakta mı/hangi sürümde" gibi meta bilgiye)
  bu mümkün — ama şimdilik kapsam dışı, test aşamasında gerek yok.

## 6. emakerp Entegrasyon Noktası

Karar (kullanıcı onayladı): Supervisor'ın "Fabrika" / "Küçük İşletme" seçimi
emakerp'in **mevcut** `/platform/new` sihirbazına eklenir — YENİ bir platform-admin
girişi kurulmaz. Bu, `actions/platform.ts:createTenantAction`'ın az önce
okunan gerçek davranışına (organizations satırı + ilk ADMIN kullanıcısı, tek
Postgres transaction'ı) bir **dallanma** eklemek anlamına geliyor:

- **Küçük İşletme** seçilirse: bugünkü akış AYNEN çalışır, hiçbir değişiklik yok.
- **Fabrika** seçilirse: emakerp tarafında organizations satırı açılmaz (bu
  kiracı emakerp'in Postgres'inde hiç yaşamayacak) — bunun yerine emakfabrika'nın
  kendi provizyon sürecini tetikleyecek bir adım gerekiyor. Bu adımın TAM şekli
  henüz tasarlanmadı çünkü §5'teki DEPLOYMENT_MODEL kararına bağlı — bugünkü test
  aşamasında (tek fabrika, kendi bünyemizde) bu entegrasyon noktası **elle**
  (Supervisor emakfabrika'yı ayrıca, manuel olarak provizyonlar) olacak;
  otomatik/tek-tıkla entegrasyon, DEPLOYMENT_MODEL netleştikten sonra Faz 12'de
  (Abonelik/SaaS fazı) ele alınacak. **Bu turda emakerp'e HİÇBİR kod
  değişikliği yapılmadı** — yalnızca bu karar dokümante edildi.
