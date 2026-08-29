# IT-SECURITY.md

SECURITY-ARCHITECTURE.md'nin (Muhasebe) TÜM ilkeleri (üç katmanlı
yetkilendirme, scrypt+JWT, RLS'in olmaması + uygulama-katmanı `companyId`
disiplini, financial immutability) IT departmanı için de AYNEN geçerli.
Bu belge yalnızca IT'YE ÖZGÜ yeni riskleri ele alır.

## 1. Secret Vault (madde 92-93)

Muhasebe'nin `EFATURA_ENC_KEY` (AES-256-GCM, `enc:` önekli, per-domain ayrı
anahtar) deseni — IT için AYRI bir anahtar: `IT_CREDENTIALS_ENC_KEY`.
`lib/crypto.ts` (emakerp'ten taşınan, henüz emakfabrika'da YAZILMADI —
Faz 3'ün parçası) network cihazı/SNMP/agent credential'larını şifreler.

```
network_credentials (id, company_id FK, asset_id FK NULL, credential_type
  ENUM('SSH','SNMP_COMMUNITY','API_KEY','VPN'), encrypted_secret TEXT
  ("enc:" önekli), created_at)
```

Frontend'e BU TABLONUN `encrypted_secret` alanı ASLA gönderilmez — API
yanıtlarında bu alan HİÇ serialize edilmez (Drizzle select'lerinde açıkça
hariç tutulur, `SELECT *` KULLANILMAZ bu tablo için).

## 2. Agent güvenliği (madde 113, 65)

Bir endpoint agent'ının (gelecekte, Faz 13+) merkezi sisteme veri
göndermesi WEB kullanıcı oturumundan (JWT cookie) FARKLI bir kimlik
doğrulama gerektirir — `TODO: AGENT_AUTH_MODEL`, olası yaklaşım: her
`it_assets` satırına bir `agent_token` (opak, mobil bearer token deseniyle
AYNI — SECURITY-ARCHITECTURE.md §2'deki `mobileSessionToken` deseninin
agent versiyonu) atanır, agent bu token'la KENDİ asset'inin verisini
YAZABİLİR ama BAŞKA hiçbir şeyi okuyamaz/yazamaz (en dar yetki).

## 3. Unauthorized Device (madde 114)

Network discovery bir cihaz bulur ama `it_assets`'te YOKSA →
`UNKNOWN_DEVICE` durumunda YENİ bir `it_assets` satırı (status='UNKNOWN'
— IT-DATABASE.md'deki lifecycle enum'ına eklenecek) OTOMATİK açılır +
IT yöneticisine alarm. Bu satır kendiliğinden CMDB'ye CI olarak eklenmez
(IT-DATABASE.md §4'teki bilinçli-seçim ilkesi) — yalnızca "IT yöneticisinin
gözden geçirmesi gereken bir kuyruk" görevi görür.

## 4. Compliance Score (madde 178, 115-116)

```
endpoint_compliance (id, asset_id FK, antivirus_status, firewall_status,
  encryption_status, patch_status, os_support_status, overall
  ENUM('COMPLIANT','NON_COMPLIANT','UNKNOWN'), checked_at)
```

`overall` uygulama katmanında HESAPLANIR (tüm alt-durumlar COMPLIANT ise
COMPLIANT) — bu bir DB trigger DEĞİL, `lib/it/compliance.ts` fonksiyonu
(Muhasebe'nin "hesaplama DB'de değil uygulama katmanında" tercihiyle
tutarlı, madde 87'nin ruhuyla).

## 5. KVKK (madde 132, Muhasebe'nin SECURITY-ARCHITECTURE.md §6'sının aynısı)

IT modülü kişisel veri (kullanıcı-cihaz ilişkisi, teknisyen konum verisi,
saha fotoğrafları) İÇERİYOR — Muhasebe'deki "KVKK silinebilir vs VUK
saklanmalı" gerilimi burada "KVKK silinebilir vs DENETİM/AUDIT için
saklanmalı" olarak tekrarlanıyor. `retention_policy` tablosu (Muhasebe'de
henüz kodlanmadı, IT ile BİRLİKTE Faz 3'te kurulacak — iki departman AYNI
tabloyu paylaşacak, `entity_type` alanıyla ayrılacak) teknisyen konum
verisi için KISA bir saklama süresi (`TODO: LOCATION_RETENTION_DAYS`),
audit_logs için UZUN bir süre önerir.

## 6. Tenant izolasyonu testi (madde 96, PDF'in kendi 151. maddesi)

Muhasebe'nin "Company A kullanıcısı Company B'nin ID'sini bilerek dahi
erişemez" testi (SECURITY-ARCHITECTURE.md §4) IT varlıkları için de
TEKRARLANACAK (Faz 3 sonunda): bir company'nin asset/ticket/network/IP
verisine başka bir company'nin kullanıcısı `requireDepartmentAccess`'i
bypass ederek erişemez.
