# SECURITY-ARCHITECTURE.md

## 1. Veritabanı rolleri (en az yetki ilkesi)

emakerp'in `emakerp_app` (DML-only) / migration (DDL yetkili, yalnızca
`scripts/migrate.ts` içinde kullanılan) ayrımı BİREBİR taşınıyor:

- `MIGRATE_DATABASE_URL` — root veya `CREATE`/`ALTER`/`DROP` yetkili MySQL
  kullanıcısı, yalnızca `drizzle-kit generate`/`scripts/migrate.ts` içinde.
- `DATABASE_URL` — çalışan uygulamanın bağlandığı kullanıcı, yalnızca
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` yetkisi (`GRANT SELECT, INSERT, UPDATE,
  DELETE ON emakfabrika.* TO 'emakfabrika'@'%'` — `CREATE`/`ALTER`/`DROP` YOK).

**Bugünkü durum, düzeltilmesi gereken:** docker-compose'un resmi MySQL imajı,
`MYSQL_USER`/`MYSQL_PASSWORD` ile açılan kullanıcıya varsayılan olarak o
veritabanı üzerinde TAM yetki (DDL dahil) veriyor. Faz 2'de `scripts/migrate.ts`
ilk çalıştığında bu kullanıcının yetkileri `REVOKE ALL, GRANT SELECT, INSERT,
UPDATE, DELETE` ile daraltılacak — emakerp'in `scripts/migrate.ts`'inin
`emakerp_app` rolünü kurduğu adımla AYNI desen. **Şu an (yalnızca altyapı
kurulumu aşamasında) bu daraltma henüz yapılmadı**, açıkça not edildi.

## 2. Kimlik doğrulama

emakerp web tarafı httpOnly cookie + JWT (`jose`), mobil tarafı opak
`Bearer <userId>.<token>` şeması kullanıyor — emakfabrika'nın departman bazlı
mobil erişimi olacağı için (PDF madde 47) AYNI ikili şema taşınacak: web için
cookie+JWT, mobil departman uygulamaları için opak bearer token
(`mobile_session_token` + `mobile_session_expires_at`, emakerp'in
`requireMobileUser` desenine birebir benzer). MFA (PDF madde 39) — Faz 3'te
(Tenant/Auth) TOTP tabanlı, opsiyonel/rol-bazlı zorunlu kılınabilir şekilde
tasarlanacak, bu turda kod yok.

## 3. Üç katmanlı yetkilendirme

emakerp'in iki katmanına (`requirePermission` = rol/izin, `requireModule` =
kiracının bu modülü satın alıp almadığı) emakfabrika'da ÜÇÜNCÜ bir katman
ekleniyor:

```
requirePermission(action)     → bu ROL bu işlemi yapabilir mi (PDF madde 40'taki
                                 view/create/update/delete/approve/... matrisi)
requireModule(departmentType) → bu FABRİKA bu departmanı satın aldı/açtı mı
requireDepartmentAccess(deptId) → bu KULLANICI bu SPESİFİK departmana atanmış mı
                                   (aynı departman türünden birden fazla şube
                                   departmanı olabilir — ör. İstanbul şubesi
                                   Muhasebe departmanı ≠ İzmir şubesi Muhasebe
                                   departmanı, bir muhasebeci ikisine birden
                                   atanmamış olabilir)
```

Üçü de BAĞIMSIZ katmanlar, biri diğerinin yerine geçmez — emakerp'teki "iki
katman aynı anda, biri diğerini ikame etmez" ilkesinin genişletilmiş hâli.

## 4. RLS'in olmaması — açık risk kabulü

DATABASE-ARCHITECTURE.md §4'te belirtildiği gibi, fiziksel DB izolasyonu
kiracılar-arası (fabrika-arası) sızıntıyı mimari olarak imkansız kılıyor, ama
AYNI fabrika içinde Company A'nın verisinin Company B tarafından görülmesini
engelleyen tek mekanizma **uygulama kodunun her sorguda `company_id` filtresini
unutmamasıdır** — Postgres RLS'in verdiği "unutsan bile DB seviyesinde durur"
ikinci savunma katmanı burada YOK. Bu, dürüstçe kabul edilen bir risk;
azaltma stratejisi:

- Her `lib/*.ts` sorgu fonksiyonu, çağıran oturumun `companyId`'sini ZORUNLU
  (opsiyonel değil) ilk parametre olarak alır — TypeScript'te bu, fonksiyonu
  companyId'siz çağırmayı DERLEME HATASI yapar (RLS'in çalışma-zamanı
  garantisi değil ama derleme-zamanı bir disiplin).
  `TODO: CONSIDER_MYSQL_VIEW_PER_COMPANY` — ileride, gerçek bir ikinci savunma
  katmanı isteniyorsa, MySQL'de her company için satır-filtreli bir VIEW
  oluşturmak (RLS'in kaba bir taklidi) değerlendirilebilir, bugün kapsam dışı.
- Faz 3'te otomatik bir test kurulur (PDF madde 85'in ruhuna uygun): Company A
  kullanıcısı Company B'nin ID'sini bilerek dahi erişemez — bu test, emakerp'in
  tenant-izolasyon testinin company-seviyesindeki karşılığı.

## 5. Şifreleme

- Şifreler: `scrypt` (emakerp'in `lib/auth.ts` deseniyle aynı, kütüphane
  bağımsız, Node built-in `crypto.scrypt`).
- e-Fatura/entegratör kimlik bilgileri: AES-256-GCM, emakerp'in `lib/crypto.ts`
  şemasıyla BİREBİR aynı format (`"enc:" + base64(iv+authTag+ciphertext)`) —
  bu kod dosyası kelimesi kelimesine taşınabilir (DB-bağımsız, saf kripto).
  Anahtar (`EFATURA_ENC_KEY`) bu fabrikaya özel, `.env`'de, asla commit edilmez.
- Transit: HTTPS zorunlu (üretimde), MySQL bağlantısı için `TODO:
  MYSQL_TLS_REQUIRE` — fabrika kendi sunucusunda barındırdığı için
  uygulama-DB bağlantısı genelde localhost/aynı ağ olacak, ama üretim dağıtım
  modeli netleştiğinde (bkz. TENANT-ARCHITECTURE.md §5) TLS zorunluluğu
  gözden geçirilecek.

## 6. KVKK / kişisel veri

PDF madde 64 — data minimization, access logging, masking, retention policy,
silme/anonimleştirme iş akışı. **Ama mali kayıtların YASAL saklama süresi
bitmeden silinmemesi gerektiği** (VUK'un 5 yıllık saklama zorunluluğu gibi —
`TODO: LEGAL_REVIEW_REQUIRED`, kesin süre SMMM ile teyit edilmeli) KVKK'nın
"gerektiğinde sil" ilkesiyle GERÇEK bir gerilim yaratıyor — bu, Faz 3'te
`retention_policy` tablosunda açıkça iki kategoriye ayrılacak: "kişisel veri,
KVKK kapsamında silinebilir" vs "mali kayıt, VUK kapsamında yasal süre
dolmadan silinemez" — otomatik silme işlemi bu ayrımı kontrol etmeden asla
çalışmayacak.

## 7. Audit log

PDF madde 38 — her audit_log satırı `user_id, company_id, action, entity,
entity_id, old_value, new_value, IP, device, timestamp, correlation_id` taşır.
Muhasebe fişi değişikliklerinde (REVERSAL/CORRECTION, dönem kilitleme/açma)
audit log YAZILMASI kritik-yol (critical path) — yani bu kayıt başarısız
olursa asıl işlem de rollback olmalı (audit log'un "best effort, olursa yazılır"
olmaması gerekiyor, finansal izlenebilirlik bunu gerektiriyor).
