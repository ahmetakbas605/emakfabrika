# API-ARCHITECTURE.md

## 1. İki yüzeyli desen (emakerp'ten aynen taşınıyor)

emakerp'te web tarafı Next.js Server Actions kullanıyor (form submit → doğrudan
sunucu fonksiyonu, ayrı bir HTTP/JSON katmanı yok), mobil tarafı ise gerçek REST
API route'ları (`/api/mobile/*`) kullanıyor — ikisi de AYNI `lib/*.ts` iş mantığı
fonksiyonlarını çağırıyor, kod tekrarı yok. emakfabrika BİREBİR aynı deseni
kullanacak: `src/actions/*.ts` (web formları) + `src/app/api/v1/*` (mobil ve
üçüncü parti entegrasyonlar), ikisi de `src/lib/*.ts`'i çağırır.

## 2. Versiyonlama (PDF madde 46)

`/api/v1/...` — emakerp'in mobil API'si hiç versiyonlanmadı (`/api/mobile/*`,
sürüm numarası yok) çünkü emakerp TEK bir merkezi dağıtım (tüm kiracılar aynı
kod sürümünü çalıştırıyor, mobil uygulama her zaman en güncel backend'e konuşuyor).
emakfabrika'da bu varsayım GEÇERSİZ: her fabrika kendi sunucusunda kendi
sürümünü çalıştırabilir, bir mobil uygulama sürümü eski bir fabrika kurulumuna
karşı konuşuyor olabilir — bu yüzden versiyonlama burada gerçek bir ihtiyaç,
süs değil. `/api/v1` ile başlanacak, kırıcı değişiklik gerektiğinde `/api/v2`
paralel yaşayacak (PDF'in kendi kuralı).

## 3. Swagger/OpenAPI

Faz 4'ten (Accounting Core, ilk gerçek API endpoint'leri) itibaren her route
için OpenAPI şeması — zod şemalarından otomatik türetme (`zod-to-openapi` veya
benzeri, henüz seçilmedi — `TODO: OPENAPI_TOOLING_CHOICE`) tercih edilecek,
elle yazılan ayrı bir OpenAPI dosyasının kod ile senkron kalması riskinden
kaçınmak için.

## 4. Idempotency (PDF madde 79)

Ödeme, fatura, e-belge, banka, mobil senkron uçlarında `Idempotency-Key` header
zorunlu — MySQL'de `idempotency_keys` tablosu (`key`, `endpoint`, `request_hash`,
`response_snapshot`, `created_at`), aynı anahtar + aynı endpoint ile ikinci
istek geldiğinde İLK yanıt aynen döner, işlem TEKRAR ÇALIŞTIRILMAZ. Bu özellikle
mobil offline-sync (PDF madde 48) için kritik — bağlantı kesilip yeniden
denenen bir istek çift kayıt oluşturmamalı.

## 5. Hata sınıflandırması (PDF madde 80)

emakerp'in `ApiError` (tek sınıf, `status` alanı taşıyan) yerine, PDF'in
istediği gibi daha ayrıntılı bir hiyerarşi:

```
BusinessError        → 422, kullanıcıya gösterilebilir Türkçe mesaj
ValidationError       → 400, zod'dan otomatik türetilir
AuthorizationError    → 403 (rol/izin yetersiz)
TenantAccessError     → 403 (company/department erişimi yok — SECURITY-
                         ARCHITECTURE.md §3'teki 3. katman)
AccountingError       → 422 (ör. dengesiz fiş — ACCOUNTING-ENGINE.md §4)
TaxCalculationError    → 422
IntegrationError       → 502 (GİB/SmartDönüşüm gibi dış sistem hatası)
ElectronicDocumentError → 502, ama `retryable: boolean` alanı taşır (bazı GİB
                         hataları yeniden denemeye uygun, bazıları değil)
```

Kullanıcıya stack trace ASLA gösterilmez (PDF madde 80) — emakerp'in mevcut
disiplini zaten bu, aynen taşınıyor.

## 6. Mobil offline senkron (PDF madde 48) — ön tasarım, Faz 13 kapsamı

```
local queue (mobil cihaz) → server (idempotency key ile) → conflict resolution
                                                            → sync result
```

Çakışma çözümü stratejisi (son-yazan-kazanır mı, alan-bazlı birleştirme mi)
henüz belirlenmedi — `TODO: CONFLICT_RESOLUTION_STRATEGY`, ilgili departmanın
mobil ihtiyacı netleştiğinde (kullanıcının "oraya gelince anlatacağım" dediği
nokta) karara bağlanacak. Muhasebe departmanının mobil ihtiyacı olup olmadığı
da henüz belirtilmedi.
