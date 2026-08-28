# emakfabrika — Mimari Genel Bakış

**Durum:** Faz 1 (Mimari) — henüz hiçbir iş modülü kodlanmadı. Bu belge, kodlamaya
başlamadan önceki analiz + mimari kararların kayıtlı hâlidir. Detaylar için:
[DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md),
[TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md),
[ACCOUNTING-ENGINE.md](./ACCOUNTING-ENGINE.md),
[MEVZUAT-MAP.md](./MEVZUAT-MAP.md),
[SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md),
[API-ARCHITECTURE.md](./API-ARCHITECTURE.md).

## 1. Bu proje nedir, emakerp'ten farkı ne

`emakerp` (kardeş repo, `../emakerp`), küçük/orta işletmeler için **paylaşımlı şema +
Postgres Row-Level Security** ile çalışan gerçek bir çok-kiracılı SaaS'tır — tüm
kiracılar TEK bir Postgres veritabanını paylaşır, izolasyon `organization_id` +
RLS politikalarıyla sağlanır. Bu, emakerp'in kiralık/abonelik modeline birebir uyar:
düşük operasyonel yük, tek dağıtım, hızlı kiracı açma.

`emakfabrika` **bilinçli olarak farklı bir modeldir**: büyük fabrika/holding
yapıları için, kullanıcının açık kararıyla, **kiracı-başına fiziksel olarak ayrı bir
MySQL veritabanı** kullanır ("her açılan fabrika kendine ait sql görecek... kendi
bünyesinde sunucuda tutar"). Bu iki proje **birbirine bağlı değildir** — emakfabrika,
emakerp'in Postgres verisine hiçbir şekilde erişmez, emakerp de emakfabrika'nın
MySQL verisine erişmez. Tek bağlantı noktası: emakerp'in Platform sihirbazında
("Yeni Firma" ekranı) Supervisor bir şirket türü seçer — **Küçük İşletme** seçilirse
bugünkü emakerp akışı (paylaşımlı Postgres kiracısı) aynen çalışmaya devam eder;
**Fabrika** seçilirse akış emakfabrika'nın kendi provizyon sürecine yönlenir (bkz.
[TENANT-ARCHITECTURE.md §6](./TENANT-ARCHITECTURE.md#6-emakerp-entegrasyon-noktası)).

Bu ayrımın nedeni kullanıcının kendi kararıdır, teknik bir zorunluluk değil — ama
mantıklıdır: fabrika ölçeğindeki bir işletme kendi verisini kendi sunucusunda,
kendi DBA'sının erişebileceği bir MySQL'de tutmak isteyebilir (yedekleme, uyumluluk,
kurumsal IT politikası); emakerp'in paylaşımlı model varsayımı (tek deploy, tüm
kiracılar aynı Postgres) bu senaryoya uymuyor.

## 2. Mevcut proje analizi (emakerp referans alınarak)

emakerp incelendi (schema.ts ~1240 satır, 40+ tablo, tam çalışan e-Fatura/e-Arşiv
SOAP entegrasyonu, RLS tabanlı kiracı izolasyonu, `requirePermission`/`requireModule`
iki katmanlı yetkilendirme, Server Actions + API route ikili yüzeyi hem web hem
mobil için). Doğrudan **kavramsal olarak** yeniden kullanılabilecek, kanıtlanmış
desenler:

- **`lib/kolay-core.ts` + `lib/ubl-invoice.ts`** (317 + 254 satır) — gerçek, çalışan
  SmartDönüşüm SOAP istemcisi ve UBL-TR 2.1 XML üretici. DB-bağımsız iş mantığı —
  MySQL'e taşınırken yalnızca kimlik bilgisi okuma katmanı değişir, SOAP/XML mantığı
  aynı kalabilir. emakfabrika'nın e-Fatura/e-Arşiv modülü bunu temel alacak (bkz.
  [ACCOUNTING-ENGINE.md §8](./ACCOUNTING-ENGINE.md#8-e-belge-motoru)).
- **`requirePermission`/`requireModule` iki katmanlı yetki deseni** — "bu rol bu
  işlemi yapabilir mi" (rol/izin) ile "bu kiracı bu modülü satın aldı mı" (plan/
  feature flag) ayrımı, PDF'in kendi 40. ve 66. maddeleriyle birebir örtüşüyor.
  emakfabrika'da üçüncü bir katman daha var: "bu kullanıcı bu **departmanda**
  mı" — bkz. [SECURITY-ARCHITECTURE.md §3](./SECURITY-ARCHITECTURE.md#3-üç-katmanlı-yetkilendirme).
- **Atomic transaction + audit log deseni** (`withTenant` içinde tek transaction'da
  fatura+stok+cari+muhasebe fişi) — PDF'in 44. maddesindeki BEGIN/COMMIT/ROLLBACK
  isteğiyle aynı disiplin, zaten kanıtlanmış.
- **Financial immutability**: emakerp hiçbir yerde muhasebeye etkisi olan bir satırı
  fiziksel silmiyor, hep durum alanı + ters kayıt. PDF'in 77. maddesiyle aynı ilke.

**Doğrudan taşınamayacaklar** (mimari fark nedeniyle):
- RLS — MySQL 8'de Postgres tarzı satır seviyesi güvenlik politikası yok. Bunun
  yerine (a) fiziksel DB izolasyonu zaten kiracılar arası izolasyonu sağlıyor
  (aynı DB'ye başka fabrika hiç bağlanamıyor), (b) TEK fabrika içindeki
  şirket/şube/departman izolasyonu uygulama katmanında (her sorguda zorunlu
  `company_id`/`department_id` filtresi) sağlanacak — bkz.
  [DATABASE-ARCHITECTURE.md §4](./DATABASE-ARCHITECTURE.md#4-rls-yerine-ne-kullanılıyor).
- JSONB — MySQL 8'in kendi `JSON` sütun tipi var (fonksiyonel olarak benzer,
  indeksleme/sorgu sözdizimi farklı) — schema.ts'teki jsonb kullanımları MySQL
  `json` tipine birebir çevrilecek.
- `gen_random_uuid()` / Postgres native UUID tipi — MySQL 8.4'te native UUID tipi
  yok (UUID genelde `CHAR(36)` veya `BINARY(16)` olarak saklanır). Karar: uygulama
  katmanında (Node `crypto.randomUUID()`) üretilip `CHAR(36)` olarak saklanacak —
  bkz. [DATABASE-ARCHITECTURE.md §2](./DATABASE-ARCHITECTURE.md#2-kimlik-uuid-stratejisi).

## 3. Eksikler (bu proje için sıfırdan yapılması gerekenler)

- Tüm muhasebe domain modeli (hesap planı, yevmiye, mizan, dönem kilitleme) — PDF'te
  tarif edilen 100 maddenin BÜYÜK kısmı emakerp'te yok (emakerp'in "Faturalar" modülü
  basit CRUD, çift-kayıt muhasebe motoru değil).
  KDV/tevkifat/beyanname "rule engine" (sabit kodlanmamış parametrik mevzuat
  motoru) — emakerp'te KDV oranı `QUOTE_VAT_RATE = 0.2` gibi sabit kodlanmış
  sabitler var, PDF'in 4. maddesindeki tam rule-engine hiç yok.
- Departman/holding hiyerarşisi (Company→Branch→Department→User) — emakerp'te
  Company/Branch/Warehouse seviyesi hiç yok (emakerp tek-şirket varsayımıyla
  çalışıyor, `organizations` = şirket).
- MySQL altyapısı, migration script'leri, güvenlik rolleri — sıfırdan (bugün
  kuruldu, bkz. §5).
- SMMM/mali müşavir portalı — emakerp'te hiç yok.

## 4. Riskler

1. **Mevzuat riski** — KDV/tevkifat oranları, e-belge şemaları, beyanname formatları
   zamanla değişir. PDF'in kendi kuralı (madde 3, 92): hiçbir oran koda gömülmeyecek,
   emin olunmayan her nokta `TODO: LEGAL_REVIEW_REQUIRED` ile işaretlenecek. Bu
   belgede ve ileride yazılacak kodda bu disiplin uygulanacak — **ben bir muhasebeci
   veya SMMM değilim, mevzuat yorumlarımı kesin hukuki/mali görüş olarak sunmuyorum.**
2. **Ölçek riski** — kiracı-başına ayrı MySQL, "1000 fabrika = 1000 ayrı veritabanı
   yönetimi" demek. Bugünkü test kurulumu (tek Docker konteyneri) bunu gizliyor;
   gerçek çok-fabrikalı üretimde her fabrikanın kendi sunucusunu/DBA'sını
   yönetmesi gerekecek — bu SAAS operasyon modelini emakerp'ten temelden
   farklılaştırıyor (bkz. [TENANT-ARCHITECTURE.md §5](./TENANT-ARCHITECTURE.md#5-üretimde-provizyon-modeli)).
3. **Çift-kayıt bütünlüğü riski** — PDF'in 86. maddesi (`TOTAL_DEBIT == TOTAL_CREDIT`)
   uygulama katmanında zorunlu kılınmalı; MySQL'de bunu CHECK constraint ile garanti
   etmek InnoDB'de sınırlı (MySQL 8.0.16+ CHECK constraint destekliyor ama
   çok-satırlı toplamlar için değil) — bu yüzden bu kural bir DB constraint DEĞİL,
   transaction-öncesi uygulama-katmanı doğrulaması olacak (bkz.
   [ACCOUNTING-ENGINE.md §4](./ACCOUNTING-ENGINE.md#4-çift-kayıt-doğrulama-motoru)).
4. **Kapsam riski** — PDF'in 100 maddesi gerçek bir muhasebe yazılımının (Logo,
   Netsis, Mikro ayarında) tam kapsamı. Kullanıcının kendi sözü ("zor diye bir şey
   yok, biraz zaman alır") doğru — bu, haftalar süren, fazlara bölünmüş bir iştir.
   PDF'in kendi 72. maddesindeki faz sırası (Architecture→Database→Tenant/Auth→
   Accounting Core→...) AYNEN izlenecek, her fazdan sonra durup test edilecek.

## 5. Bugün yapılanlar (bu faz)

- Yeni repo: `çalışmalarım/emakfabrika`, Next.js 16.3.2 + TypeScript + Drizzle ORM
  (mysql2 sürücüsü) — emakerp'in kanıtlanmış sürüm/araç seçimleriyle aynı, yalnızca
  DB dialekti farklı. `npm run build` ile doğrulandı (temiz derleme).
- `docker/docker-compose.yml` — MySQL 8.4, 127.0.0.1-only bağlanma (emakerp/
  emakelektron/emakbilisim'in Postgres konteynerleriyle AYNI güvenlik deseni),
  ayrı `name: emakfabrika` (bkz. proje hafızası — docker-compose proje adı
  çakışması riski). Gerçek bir MySQL sunucusuna bağlanıldı ve doğrulandı
  (`mysql2` ile canlı SELECT VERSION() çağrısı, MySQL 8.4.11).
- Henüz **hiçbir iş tablosu/domain kodu yazılmadı** — `src/db/schema.ts` boş.
  Sıradaki adım (onayınızla): [DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md)'te
  tarif edilen ilk şema + `scripts/migrate.ts` + kullanıcı/departman/rol
  altyapısını kodlamak (Faz 2-3).

## 6. Geliştirme fazları (PDF madde 72'den, bu projeye uyarlanmış)

| Faz | İçerik | Durum |
|---|---|---|
| 1 | Mimari (bu belgeler) | ✅ Tamamlandı — onay bekliyor |
| 2 | Database (MySQL şema, migration altyapısı) | Onay bekliyor |
| 3 | Tenant/Auth (fabrika içi şirket/şube/departman, kullanıcı, oturum) | — |
| 4 | Accounting Core (hesap planı, yevmiye, muhasebe fişi motoru) | — |
| 5 | Ön Muhasebe (Cari/Stok/Fatura/Kasa/Banka — basit mod) | — |
| 6 | Satış/Alış (fatura motoru, KDV/tevkifat) | — |
| 7 | Stok (maliyet yöntemleri, muhasebe entegrasyonu) | — |
| 8 | Kasa/Banka (çek/senet, mutabakat) | — |
| 9 | E-Belgeler (e-Fatura/e-Arşiv/e-İrsaliye/e-Defter) | — |
| 10 | Raporlar (mizan, bilanço, gelir tablosu) | — |
| 11 | SMMM Portalı | — |
| 12 | Abonelik/SaaS (fabrika-içi lisanslama, feature flag) | — |
| 13 | Mobil (departman bazlı Android/iOS) | — |
| 14 | AI/OCR | — |

**Not:** Kullanıcı ilk departman olarak Muhasebe'yi verdi — Faz 4-10 arası bu
belgede ve [ACCOUNTING-ENGINE.md](./ACCOUNTING-ENGINE.md)'de detaylandırılan iş
bu departmanın kapsamı. Sonraki departman PDF'leri geldikçe (Satış, Stok/Depo,
İK, Üretim vb.) bu belgeler ilgili bölümlerle genişletilecek — PDF'in kendi
kuralı gereği ("her aşamadan sonra test et, hata varsa bir sonraki faza geçme")
departmanlar da sırayla, tek tek inşa edilecek.
