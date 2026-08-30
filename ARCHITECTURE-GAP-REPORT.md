# ARCHITECTURE-GAP-REPORT.md

"EMAKFABRİKA ERP — HOLDİNG + FABRİKA + SAHA + MOBİL" master prompt'una göre
kodlamaya başlamadan önce mevcut repo'nun (177 tablo, 39 migration, 124 dosyada
`companyId` thread eden ~410 çağrı noktası — Explore taramasıyla doğrulandı)
gerçek envanteri. Bkz. [ASSUMPTIONS.md](./ASSUMPTIONS.md) için tenant-modeli
kararı, [MASTER-ERP-ROADMAP.md](./MASTER-ERP-ROADMAP.md) için faz planı.

## MEVCUT

**Core/Org/Auth** — `companies`/`branches`/`departments`/`departmentTypes`/
`roles`/`permissions`/`rolePermissions`/`users`/`userDepartmentAccess`, JWT
pointer + DB-doğrulanan `user_sessions` (çoklu oturum), TOTP MFA,
`requireDepartmentAccess` üç katmanlı yetki (rol × departman × factory-admin
fallback'i).

**Muhasebe/Finans** — tam hesap planı, yevmiye/fiş motoru, dönem kilitleme,
kasa/banka/çek, masraf merkezi, bütçe (+item+commitment), sabit kıymet/
amortisman. **~20 tablo, `lib/accounting.ts`+`lib/budgets.ts`+ilgili dosyalar.**

**Depo/Stok** — depo, stok kartı, lokasyon, bakiye, transfer, rezervasyon.

**Satın Alma** — Requisition→RFQ/Tender→Teklif→Değerlendirme (teknik+ticari
skorlama)→Award→PO→Mal Kabul→Tedarikçi Faturası, tam onay zinciriyle.
**23 tablo, `lib/procurement/` (9 dosya, 102 export).**

**İK** — Employee Core, sözleşme/nitelik versiyon zinciri, PDKS (vardiya/cihaz/
mesai), İzin/Fazla Mesai, Erişim Kontrolü (RFID kart/bölge/grup), Ücret/Prim
(Bonus) — **21 tablo, `lib/hr/` (11 dosya, 85 export).**

**IT/ITSM** — CMDB, Service Desk (ticket/SLA/incident/problem/change), Field
Service, Network/IPAM/Diagram, Monitoring, Backup, Lisans/Garanti/Sözleşme,
Bilgi Bankası. **En büyük domain: ~90 tablo, `lib/it/` (25 dosya, 197 export)**
— ama yalnızca `dashboard/departments/[id]/it/*` altında, üst-seviye
`/dashboard/it` rotası YOK.

**Core Security Platform** (bu oturumda tamamlandı) — audit hash-zinciri,
alan-seviyesi maskeleme, MFA, çoklu oturum yönetimi, SoD, onay-müdahale
koruması, KVKK veri sahibi talepleri, legal hold/retention, break-glass —
**9 tablo, `lib/security/` (11 dosya, 65 export).**

**Master Data** — para birimi, ürün, cari (parti), fiyat listesi, ödeme vadesi.

**API** — `/api/v1` prefix zaten kurulu (auth, users, approvals, IT asset/
ticket alt-rotaları) — versioning konvansiyonu master prompt §64 ile örtüşüyor.

## EKSİK

Aşağıdakilerin HİÇBİRİ bugün mevcut değil (grep ile doğrulandı, tahmin değil):

- **Holding tablosu/gruplama** — `companies` tablosunda holding'e bağlanma yok,
  4 test şirketi birbirinden bağımsız satırlar (bkz. ASSUMPTIONS.md §1).
- **MES / BOM / MRP / Üretim Emri** — hiç yok.
- **EAM (genel varlık bakımı) / Filo / Tesis Yönetimi** — `maintenancePlans`/
  `maintenanceWorkOrders` VAR ama IT/saha-servis kapsamlı, genel fabrika
  ekipmanı/bina/araç bakımı değil.
- **Proje Yönetimi, Hukuk (genel sözleşme/dava), Risk Yönetimi, Çevre/İSG
  (HR dışı), Ar-Ge** — hiç yok.
- **Hazine (nakit akış tahmini/hedge), Enerji Takibi** — yok (yalnızca temel
  kasa/banka/çek var).
- **BI/Integration Hub/Event Bus/Feature Flags** — kod içi yorumlarla
  ("henüz gerçek bir event bus YOK") açıkça doğrulanmış eksiklikler.
- **Branch (şube) gerçek kullanımı** — şema/FK var ama CRUD UI yok, canlı
  DB'de 0 satır.

## ÇAKIŞAN

- Master prompt §6'nın "multi-tenant SaaS, tenant izolasyonu TÜM katmanlarda"
  ifadesi, harfiyen okunursa mevcut database-per-tenant kararıyla ÇAKIŞIYOR —
  çözüm ve gerekçe ASSUMPTIONS.md §1'de.
- Master prompt §116/153, `/docs` alt klasör yapısı istiyor; mevcut repo
  düz (flat), BÜYÜK-HARF-TİRELİ dosya adlarıyla kök dizinde 20 mimari
  belgesi zaten tutuyor (ör. `IT-ARCHITECTURE.md`, `SECURITY-ARCHITECTURE.md`).
  Kural 2 gereği ("mevcut proje yapısını bozma") **mevcut konvansiyon
  korunuyor** — bu belge de dahil yeni belgeler kök dizinde, aynı isimlendirme
  ile.
- Master prompt §51'in ABAC listesi (`Company/Department/Position/Location/
  Data Classification/Approval Limit/Employee Scope`) mevcut `view_sensitive`
  tek-alanlı ABAC'tan (bu oturumda eklendi) daha geniş — gerçek bir çakışma
  değil, kapsamın genişletilmesi gereken bir nokta (Faz 0'da ele alınacak).

## RİSKLİ

- **İç-seviye izolasyon 410 noktada elle uygulanıyor**, yapısal (derleme-zamanı
  veya DB-zamanı) bir garanti yok — 2026-08-29'da `requireDepartmentAccess`'te
  GERÇEK bir çapraz-şirket sızıntısı bulunup düzeltildi (bkz. `dal.ts:108-112`
  yorumu). Bu, master prompt §80'in "Tenant A → Tenant B verisini görebiliyor
  mu?" test talebinin TAM olarak hedeflediği risk sınıfı.
- **`users.email` global-unique** — bir holding-DB içinde birden fazla şirket
  varsa (zaten var, 4 satır) bu bir tasarım kısıtı, kritik değil ama not
  edildi (ASSUMPTIONS.md §3).
- **IT/ITSM'in üst-seviye rotası yok** — 197 export'luk en büyük domain
  yalnızca tek bir departmanın (IT) içine gömülü; Holding/çoklu-fabrika
  senaryosunda "bu holding'in TÜM IT varlıkları" gibi bir görünüm gerekebilir,
  bugün departman-scope'lu.

## DEPRECATED

Bulunamadı — kod tabanı 39 migration boyunca sürekli additive büyümüş
(section "Migration Needed" altında not edilen tek gerçek "eski model" web
oturum tablosu, bu oturumda zaten kaldırıldı: `users.sessionToken`).

## REFACTOR NEEDED

- **Şirket/departman izolasyon deseni** — 410 elle-yazılmış filtre yerine
  ortak bir yardımcı/desen (Faz 0 kapsamı, detay MASTER-ERP-ROADMAP.md'de).
- **IT/ITSM'in navigasyonu** — üst-seviye bir görünüm eklenmesi (yeni domain
  değil, mevcut 197 export'un YENİDEN kullanımı).

## MIGRATION NEEDED

- `holdings` tablosu + `companies.holdingId` (additive, mevcut 4 satır
  varsayılan bir holding'e bağlanacak — bkz. ASSUMPTIONS.md §3).
- Yeni domainlerin (MES, EAM, Fleet, ...) her biri kendi additive migration
  setini gerektirecek — sırası MASTER-ERP-ROADMAP.md'de.
