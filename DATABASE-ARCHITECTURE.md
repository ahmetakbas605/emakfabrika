# DATABASE-ARCHITECTURE.md

MySQL 8.4, Drizzle ORM (`drizzle-orm/mysql2` dialekt), `mysql2` sürücüsü.
Migration: `drizzle-kit generate` + kendi `scripts/migrate.ts` (emakerp'in
`db:generate`/`db:migrate` ikilisiyle aynı desen).

## 1. Neden MySQL 8.4 (spesifik sürüm kararı)

Kullanıcının kararı "MySQL" idi, spesifik sürümü belirtmedi — 8.4 (LTS, 8.0'ın
yerini alan güncel uzun-destekli sürüm, 2026 itibarıyla aktif destekte) seçildi
çünkü: (a) `CHECK` constraint desteği (8.0.16+), (b) `JSON_TABLE` (8.0.19+,
ileride raporlama sorgularında JSON alan sütunları düzleştirmek için), (c) daha
iyi `information_schema` performansı. **Fabrika kendi sunucusunda 5.7 veya eski
8.0.x çalıştırıyorsa** bu bir uyumsuzluk riski — provizyon sürecinde (bkz.
TENANT-ARCHITECTURE.md) hedef sunucunun MySQL sürümü doğrulanmalı,
`TODO: PROVISIONING_VERSION_CHECK`.

## 2. Kimlik (UUID) stratejisi

PDF madde 78: "UUID kullan, public API'de sequential integer ID expose etme."
MySQL 8.4'te native UUID tipi yok. Üç seçenek değerlendirildi:

- `CHAR(36)` metin olarak sakla (`"a1b2c3d4-..."`) — basit, okunabilir, ama
  16 byte yerine 36 byte + B-Tree indeksleme metinsel karşılaştırma nedeniyle
  daha yavaş.
- `BINARY(16)` (MySQL'in `UUID_TO_BIN()`/`BIN_TO_UUID()` fonksiyonlarıyla) —
  performans için daha iyi ama her sorguda dönüşüm gerektirir, debug ederken
  ham veriyi okumak zorlaşır.
- **Karar: `CHAR(36)`, uygulama katmanında `crypto.randomUUID()` (Node
  built-in, RFC 4122 v4) ile üretilir.** Gerekçe: bu projenin başlangıç
  ölçeğinde (tek fabrika, muhtemelen on binlerce-yüzbinlerce satır, milyonlarca
  değil — PDF'in "milyonlarca kayıt" senaryosu emakerp gibi ÇOK kiracılı paylaşımlı
  bir DB için gerçekçi, TEK fabrikanın kendi DB'si için performans farkı bu
  ölçekte ihmal edilebilir) okunabilirlik/debug kolaylığı, BINARY(16)'nın
  getirdiği karmaşıklığa değmiyor. İleride gerçek performans sorunu ölçülürse
  (`EXPLAIN ANALYZE` ile kanıtlanmış, varsayımla değil) `BINARY(16)`'ya geçiş
  değerlendirilebilir — bu yüzden UUID üretimi/okuma tek bir `lib/id.ts`
  yardımcısı arkasına gizlenecek, ileride değişse bile çağıran kod değişmeyecek.

## 3. JSONB → JSON

emakerp'in `jsonb` kullandığı yerler (esnek alanlar: sözleşme `fields`, teklif
`items`, banka hesapları listesi vb.) MySQL'in `json` sütun tipine taşınır.
Fark: Postgres JSONB ikili/indekslenebilir, MySQL JSON de dahili olarak ikili
saklanır ve `JSON_EXTRACT`/`->>` operatörleriyle sorgulanabilir — fonksiyonel
olarak yeterli, ama MySQL'de JSON alanları üzerinde GIN-tarzı genel indeks yok;
sık sorgulanan bir JSON alanı varsa (ör. "tevkifat kodu") **generated column +
normal indeks** deseni kullanılacak (MySQL 8'in `AS (JSON_EXTRACT(...)) STORED`
özelliği) — ihtiyaç doğdukça, önceden değil.

## 4. RLS yerine ne kullanılıyor

emakerp'in savunma-derinliği modeli (uygulama filtresi + DB seviyesi RLS) burada
**tek katmana** iniyor çünkü fiziksel izolasyon zaten en güçlü sınır: bu MySQL
veritabanına yalnızca BU fabrikanın emakfabrika örneği bağlanabiliyor, başka
hiçbir kiracının kod yolu bu bağlantı dizesini bilmiyor bile. Yani "kiracılar
arası" sızıntı riski mimari olarak yok edildi (emakerp'teki asıl risk — aynı
uygulama süreci farklı kiracıların verisini aynı bağlantı havuzundan okuyor —
burada hiç oluşmuyor).

Ama TEK fabrika içinde hâlâ bir izolasyon ihtiyacı var: holding → şirket →
şube → departman hiyerarşisi (PDF madde 5, 56-57'nin "holding bazlı, departman
bazlı" isteğiyle birebir). Bu, RLS'siz, **uygulama katmanında zorunlu filtre**
ile sağlanacak — emakerp'in `withTenant()` yardımcısının küçük ölçekli karşılığı:
her sorgu katmanı fonksiyonu (`lib/*.ts`) çağıran oturumun `companyId`/
`departmentId`'sini parametre olarak alır ve WHERE koşuluna zorunlu ekler; bu
asla "opsiyonel" bir filtre değil, fonksiyonun imzasının bir parçası (TypeScript
tip sisteminde `companyId: string` zorunlu alan, unutulması derleme hatası
verir) — RLS'in verdiği "unutsan bile DB seviyesinde durur" garantisini
TAM vermez, bu bilinçli bir risk kabulüdür, dokümante edildi (bkz.
SECURITY-ARCHITECTURE.md §4).

## 5. Öncelikli tablo grupları (Faz 2-4 kapsamı — henüz kodlanmadı)

PDF madde 42'deki tablo listesi bu proje için üç katmana ayrılıyor:

**A) Çekirdek/iskelet (Faz 2-3 — tenant/auth):**
```
company            (bu fabrikanın kendi şirket(ler)i — holding çoklu şirket olabilir)
branch             (company_id FK)
department         (company_id FK — Muhasebe, Satış, Stok/Depo, İK, Üretim...)
users              (department_id FK, ayrıca birden fazla departmana erişimi
                    olabilir → user_department_access ara tablosu)
roles / permissions / user_roles  (PDF madde 40'taki yetki matrisi)
sessions           (JWT yerine — bkz. SECURITY-ARCHITECTURE.md §2)
audit_logs
```

**B) Muhasebe çekirdeği (Faz 4 — ACCOUNTING-ENGINE.md'de detaylı):**
```
accounting_accounts        (hesap planı, kullanıcı tanımlı — PDF madde 15)
accounting_journals        (fiş başlığı)
accounting_journal_lines   (fiş satırları — borç/alacak)
accounting_posting_rules   (PDF madde 16 — otomatik fiş kuralları)
accounting_periods         (dönem, dönem kilitleme — PDF madde 17)
tax_rules / withholding_rules / document_rules  (mevzuat motoru — bkz. MEVZUAT-MAP.md)
```

**C) Ön muhasebe / iş tabloları (Faz 5-8):**
```
cari_accounts / cari_transactions   (emakerp'ten kavramsal olarak taşınabilir,
                                     ama borç/alacak PDF madde 9'daki tam alan
                                     setiyle — VKN/TCKN/mersis/risk limiti vb.)
products / stock_movements
invoices / invoice_items / invoice_taxes / invoice_withholdings
cash_accounts / cash_transactions
bank_accounts / bank_transactions
checks / promissory_notes
```

Her tablo, PDF'in ilgili maddesindeki tam alan setiyle, ACCOUNTING-ENGINE.md'de
satır satır gerekçelendirilerek Faz 4'te kodlanacak — burada yalnızca gruplama
ve sıralama kararı var, henüz DDL yok.

## 6. Bağlantı yönetimi

`mysql2/promise`'in connection pool'u (emakerp'in `pg.Pool` kullanımıyla aynı
felsefe) — tek pool, `DATABASE_URL` (DML-kısıtlı rol) ile. Migration/DDL ayrı,
`MIGRATE_DATABASE_URL` (root veya CREATE/ALTER yetkili rol) ile, yalnızca
`scripts/migrate.ts` içinde kullanılır, çalışan uygulama asla bu bağlantıyı
açmaz — emakerp'in `emakerp_app` (DML-only) / migration (superuser) ayrımıyla
BİREBİR aynı ilke (bkz. SECURITY-ARCHITECTURE.md §1).

## 7. Bugüne kadar doğrulanan altyapı

- MySQL 8.4.11 konteyneri ayakta, 127.0.0.1:3307'de dinliyor, sağlık kontrolü
  yeşil.
- `mysql2` ile gerçek bir bağlantı kurulup `SELECT VERSION()` çalıştırıldı —
  gerçek, canlı doğrulama (varsayım değil).
- Henüz hiçbir tablo/migration yok — `drizzle-kit generate` ilk kez Faz 2'de
  (onayla) çalıştırılacak.
