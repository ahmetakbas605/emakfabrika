# IT-ARCHITECTURE.md

İkinci departman: **IT (ITSM/CMDB/Asset/Field Service/Network Monitoring)**.
Bu belge, kullanıcının 211 maddelik IT şartnamesinin "KOD YAZMAYA BAŞLAMA —
önce analiz, sonra mimari" kuralına uyarak yazıldı. Aşağıda önce mevcut
sistemin analizi, sonra önerilen IT mimarisi var.

## 1. CURRENT ARCHITECTURE (mevcut sistem analizi)

Muhasebe departmanı (Faz 1-5) ile kurulan altyapı **aynen** IT departmanının
temelini oluşturacak — PDF'in kendi kuralı ("mevcut authentication/tenant
mimarisini yeniden yazma, mevcut sistemleri tekrar oluşturma") burada zaten
karşılanmış durumda çünkü emakfabrika'nın kendisi henüz genç:

| Katman | Mevcut durum | IT departmanı için |
|---|---|---|
| Frontend | Next.js 16 App Router, Server Actions, inline-style (henüz ayrı bir component kütüphanesi yok) | Aynı desen — `/dashboard/departments/[departmentId]/...` altına yeni rotalar |
| Backend | `src/lib/*.ts` iş mantığı + `src/actions/*.ts` server action'lar | Aynı — `src/lib/it/*.ts`, `src/actions/it/*.ts` (madde 179'daki modüler klasörleme) |
| Veritabanı | MySQL 8.4 (PDF bu kez "PostgreSQL kullan" diyor — bkz. §9 çelişki notu) | AYNI MySQL veritabanı, yeni tablolar |
| Tenant/Company/Branch | `companies`/`branches` tabloları zaten var | Aynı — IT varlıkları `company_id`/`branch_id` taşıyacak |
| Department | `departments` (department_type_code FK → `department_types`) | Yeni satır: `department_types.code = 'IT'` |
| User/Auth | `users`, scrypt+JWT/opak mobil token, `user_department_access` | Aynı — IT personeli aynı `users` tablosunda, IT departmanına atanır |
| Yetkilendirme | 3 katman: `requireSession`→`requireFactoryAdmin`→`requireDepartmentAccess(departmentId, permission)` | Aynı fonksiyonlar — `moduleKey='IT'` ile yeni `role_permissions` satırları |
| Audit | `audit_logs` (companyId, userId, action, entity, entityId, old/new value) | Aynı tablo, yeni `entity` değerleri (`it_assets`, `tickets`, vb.) |
| Muhasebe entegrasyonu | `lib/accounting.ts:postJournal` | IT'nin KENDİ muhasebe motoru OLMAYACAK (PDF madde 125) — asset satın alma/demirbaş kaydı bu fonksiyonu ÇAĞIRACAK |
| Stok entegrasyonu | Yok (Muhasebe'nin kapsamında stok modülü yok) | **Gerçek boşluk** — bkz. §9 Riskler |
| e-Belge | `lib/e-document/provider.ts` (tek-sağlayıcı adaptör, henüz yapılandırılmamış) | IT'nin kendi e-belge ihtiyacı yok, dokunulmuyor |
| Approval/Workflow engine | Yok (henüz kurulmadı) | PDF madde 140: "yeni approval engine oluşturup sistemi bölme" — bkz. §9 |
| Mobile | Yok (emakfabrika'nın henüz mobil istemcisi yok) | PDF madde 85: saha teknisyeni ekranları gerekiyor — bkz. §7 |
| Notification | Yok | PDF madde 120: email/push/SMS adapter — bkz. §7 |

**Çakışma yok** — IT departmanı greenfield bir ekleme, mevcut hiçbir tabloya
dokunmuyor, mevcut hiçbir davranışı bozmuyor (EXISTING CODE CONFLICTS: yok).

### 1.1. Önemli çelişki: PDF "PostgreSQL kullan" diyor

IT PDF'i (madde 97) "PostgreSQL kullan, UUID kullan, NUMERIC kullan,
TIMESTAMPTZ kullan" diyor — ama bu proje (emakfabrika) kullanıcının kendi
kararıyla **MySQL** kullanıyor (TENANT-ARCHITECTURE.md, kiracı-başına fiziksel
DB modeli). Bu, PDF'in muhtemelen genel bir şablon metninden (başka projeler
için de kullanılan bir "master prompt") geldiğini gösteriyor. **Karar: MySQL'de
kalınacak** — aynı fabrikanın Muhasebe departmanıyla AYNI veritabanını
paylaşması gerekiyor (aksi hâlde CMDB'nin "asset satın alma → muhasebe
entegrasyonu" zinciri iki ayrı veritabanı arasında dağıtık transaction
gerektirirdi, ki bu hem PDF'in kendi madde 195'i ["tek transaction içinde
güvenli"] hem de genel mimari ile ÇELİŞİR). UUID zaten CHAR(36) olarak
kullanılıyor (DATABASE-ARCHITECTURE.md §2), NUMERIC yerine MySQL DECIMAL
kullanılıyor (fonksiyonel eşdeğer), TIMESTAMPTZ'nin MySQL karşılığı yok —
MySQL `TIMESTAMP` UTC saklar + bağlantı saat dilimine göre dönüştürür,
uygulama sunucusu ve MySQL AYNI saat dilimini (UTC) kullanacak şekilde
yapılandırılacak (`TODO: TIMEZONE_CONFIG_VERIFY`, Faz 3'te).

## 2. PROPOSED IT ARCHITECTURE

PDF madde 179'daki modüler klasörleme AYNEN kullanılacak:

```
src/lib/it/
  assets.ts            # IT Asset Management (Faz 4)
  cmdb.ts               # Configuration Items + ilişkiler (Faz 5)
  computers.ts           # Bilgisayar-özel alanlar (madde 7)
  software.ts             # Software Asset Management
  licenses.ts               # License Management + süre uyarıları
  warranties.ts
  contracts.ts
  tickets.ts               # Service Desk çekirdeği (Faz 6-7)
  incidents.ts
  problems.ts
  changes.ts
  work-orders.ts            # Field Service (Faz 8)
  field-service.ts
  maintenance.ts             # Faz 9
  ipam.ts                    # Faz 11
  network.ts
  network-diagram.ts          # Faz 12
  monitoring.ts               # Faz 13 (bkz. §8 — ayrı mimari prensip)
  sla.ts
  knowledge-base.ts            # Faz 15
  vendors.ts
  spare-parts.ts
  it-reports.ts                # Faz 16
```

Her dosya, Muhasebe'de kurulan AYNI disiplinle yazılacak: `companyId` zorunlu
ilk parametre, `AccountingError` benzeri kendi `ItError` sınıfı (veya PDF
madde 80'in tam sınıflandırması — `BusinessError`/`ValidationError`/
`AuthorizationError`/`TenantAccessError`/`IntegrationError` — bu IT modülüyle
BİRLİKTE ilk kez tam olarak kurulacak, Muhasebe'de basitleştirilmiş tek
`AccountingError` yeterliydi, IT'nin dış entegrasyon yüzeyi — SNMP/agent/
webhook — çok daha geniş olduğu için tam hiyerarşi burada gerekli).

## 3. DATABASE MODEL (özet — tam DDL IT-DATABASE.md'de)

PDF madde 98'deki ~80 tablo, Muhasebe'nin DATABASE-ARCHITECTURE.md
disipliniyle FAZLARA göre gruplanıyor (hepsi TEK SEFERDE açılmayacak):

- **Faz 4 (Asset):** `it_assets`, `it_asset_types`, `it_asset_models`,
  `it_asset_assignments`, `it_asset_locations`, `it_asset_status_history`
- **Faz 5 (CMDB):** `configuration_items`, `ci_relationships` (madde 99-100'deki
  DEPENDS_ON/RUNS_ON/... ilişki tipleri)
- **Faz 6-7 (Service Desk/Ticket):** `service_desk_tickets`, `ticket_comments`,
  `ticket_attachments`, `ticket_status_history`, `ticket_assignments`,
  `ticket_watchers`, `ticket_work_logs`, `ticket_relations`, `incidents`,
  `problems`, `problem_incidents`, `changes`, `change_tasks`,
  `change_approvals`
- **Faz 8 (Field Service):** `work_orders`, `work_order_assignments`,
  `work_order_checklists`, `work_order_checklist_items`, `work_order_parts`,
  `field_visits`, `technician_locations`
- **Faz 9 (Maintenance):** `maintenance_plans`, `maintenance_schedules`,
  `maintenance_work_orders`, `maintenance_checklists`
- **Faz 10 (License/Warranty/Contract):** `software_products`,
  `software_installations`, `software_licenses`, `license_assignments`,
  `warranties`, `contracts`, `contract_assets`, `vendors`
- **Faz 11 (IPAM/Network):** `network_devices`, `network_interfaces`,
  `network_ports`, `network_vlans`, `network_subnets`, `ip_addresses`,
  `ip_assignments`, `mac_addresses`
- **Faz 12 (Network Diagram):** `network_diagrams`, `network_nodes`,
  `network_links`, `network_diagram_versions`
- **Faz 13 (Monitoring):** `monitoring_targets`, `monitoring_metrics`,
  `monitoring_alerts`, `monitoring_events`, `backup_jobs`, `backup_results`
  (bkz. §8 — bu grup AYRI bir mimari prensip gerektiriyor, zaman-serisi hacmi)
- **Faz 15 (Knowledge Base):** `knowledge_articles`, `knowledge_categories`
- **Ortak:** `sla_policies`, `sla_rules`, `business_hours`,
  `holiday_calendars`, `it_notifications`, `it_audit_logs` (ya da mevcut
  `audit_logs`'un genişletilmiş kullanımı — `TODO: AUDIT_TABLE_REUSE_VS_NEW`,
  IT-DATABASE.md'de karara bağlanacak)

## 4. MODULE DEPENDENCIES

```
CMDB (configuration_items)  ◄── IT Asset Management (it_assets) — her asset
                                  aynı zamanda bir CI'dır (1:1 veya CI, asset'in
                                  üst kümesi — TODO: CI_ASSET_RELATIONSHIP,
                                  IT-DATABASE.md'de netleşecek)
     ▲
     │ CI referans eder
     │
Service Desk (tickets) ──► Incident ──► Problem
     │
     ├──► Work Order ──► Field Service ──► Spare Parts (stok entegrasyonu — §9)
     │
     └──► SLA (business_hours + holiday_calendars ile hesaplanır)

Network/IPAM ──► Network Diagram (görsel katman, ayrı versiyonlanan tablo)
     │
     └──► Monitoring (collector/agent, AYRI mimari — §8) ──► Alert ──► Incident (madde 76 zinciri)

License/Warranty/Contract ──► Vendor ──► (opsiyonel) Muhasebe (lib/accounting.ts, madde 125)
```

Hiçbir modül CMDB'yi BYPASS ederek doğrudan network/server bilgisine
erişmeyecek — CMDB "tek gerçek kaynak" (single source of truth) prensibiyle
merkezde duruyor (PDF madde 5: "CMDB sistemin merkezinde olacaktır").

## 5. API ARCHITECTURE

PDF madde 104'teki `/api/v1/it/*` yapısı — emakfabrika'nın API-ARCHITECTURE.md'sinde
zaten Muhasebe için `/api/v1` kararı verilmişti (versiyon numarası GERÇEK bir
ihtiyaç, her fabrika kendi sürümünü çalıştırabildiği için). IT modülü AYNI
`/api/v1` altına eklenir:

```
/api/v1/it/assets
/api/v1/it/cmdb
/api/v1/it/tickets
/api/v1/it/incidents
/api/v1/it/problems
/api/v1/it/changes
/api/v1/it/work-orders
/api/v1/it/network
/api/v1/it/ipam
/api/v1/it/monitoring          # webhook alıcısı DAHİL (madde 121)
/api/v1/it/licenses
/api/v1/it/maintenance
```

Mobil saha teknisyeni uygulaması (§7) da bu API'leri kullanacak — emakerp'in
web/mobil ikili yüzey deseni (API-ARCHITECTURE.md §1) burada da geçerli.

## 6. SECURITY MODEL

SECURITY-ARCHITECTURE.md §3'teki üç katman AYNEN geçerli — dördüncü bir
katman YOK, PDF'in istediği RBAC zaten `role_permissions.moduleKey` ile
modül-bazlı ayrım sağlıyor (`moduleKey='IT'`). PDF madde 94-95'teki rol/izin
listesi, ACCOUNTING'inkine PARALEL ama IT'ye özel yeni kod/isimlerle
`scripts/migrate.ts`'e eklenecek (Faz 3):

Roller (madde 94, platform-seviyesi olanlar hariç — TENANT-ARCHITECTURE.md §6
gereği): `IT_MANAGER`, `SERVICE_DESK_AGENT`, `NETWORK_ENGINEER`,
`SYSTEM_ENGINEER`, `SECURITY_ENGINEER`, `FIELD_TECHNICIAN`, `HELP_DESK`,
`ASSET_MANAGER`, `AUDITOR`, `END_USER`. `IT_ADMIN` yerine mevcut
`isFactoryAdmin` bayrağı kullanılacak (madde 65'in "platform yöneticisi"
kavramı zaten `requireFactoryAdmin` ile karşılanıyor, ayrı bir IT_ADMIN
rolüne gerek yok — PDF madde 67 "gereksiz abstraction oluşturma" ile
tutarlı).

İzinler (madde 95): mevcut 11 izinlik küme (`view/create/update/delete/
approve/cancel/export/print/post/close_period/reopen_period`) IT'nin
ihtiyaçlarına TAM uymuyor — `assign`, `configure`, `monitor`,
`manage_credentials`, `manage_assets`, `manage_network`, `manage_users`
eksik. `permissions` tablosu genişletilecek (Faz 3), ama `close_period`/
`reopen_period` gibi Muhasebe'ye özel olanlar IT modülünde hiç
kullanılmayacak (moduleKey='IT' için hiç `role_permissions` satırı
oluşmayacak).

**Secret Vault (madde 92-93):** Network cihazı credential'ları (firewall
şifresi, SNMP community, VPN credential) `lib/e-document/provider.ts`'in
yanına, `lib/crypto.ts` (AES-256-GCM, emakerp'ten taşınan desen — henüz
emakfabrika'da YAZILMADI, bu Faz 3'ün bir parçası olacak) ile şifrelenmiş
saklanacak — frontend'e ASLA plaintext gönderilmeyecek.

## 7. MOBILE ARCHITECTURE

PDF madde 85, 141: saha teknisyeni için MY JOBS / TICKET / WORK ORDER /
SCAN QR / LOCATION / PHOTO / WORK LOG / CHECKLIST / PARTS / TEST /
SIGNATURE / CLOSE JOB ekranları. emakfabrika'nın **henüz hiçbir mobil
istemcisi yok** (emakadroid AYRI bir proje, emakerp'e bağlı — emakfabrika'ya
bağlı DEĞİL). Bu, gerçek bir açık karar noktası:

`TODO: MOBILE_APP_STRATEGY` — üç seçenek: (a) emakfabrika için sıfırdan yeni
bir Expo/RN uygulaması, (b) emakadroid deseninin bir kopyası/fork'u (aynı
mimari, farklı API_URL), (c) mobil-web (PWA, responsive Next.js sayfaları —
"gerçek" mobil değil ama saha teknisyeninin kamerayı/GPS'i kullanabilmesi
web API'leriyle KISMEN mümkün). Bu proje aşamasında (Faz 8 Field Service'e
kadar) karar verilmesi gerekmiyor — QR/foto/checklist ALTYAPISI (backend +
web) önce kurulacak, mobil istemci kararı kullanıcıya sorulacak.

## 8. MONITORING ARCHITECTURE

PDF madde 101'in "Collector/Agent mimarisi, monitoring core'u ERP
transaction database'ine gereksiz bağlama" ilkesi ÇOK ÖNEMLİ ve
DATABASE-ARCHITECTURE.md'nin genel MySQL kararıyla gerilim içinde: monitoring
metrikleri (ping/CPU/RAM/interface traffic, madde 18) saniyeler/dakikalar
seviyesinde, yüksek hacimli zaman-serisi veridir — Muhasebe'nin
`accounting_journal_lines` gibi düşük-hacimli, kalıcı-transactional
tablolarıyla AYNI disiplinle yönetilemez.

**Karar:** `monitoring_metrics` AYRI bir tablo grubu, agresif retention (PDF
madde 103: ham metrik 30 gün, agregasyon 1 yıl) ve zorunlu partitioning ile
kurulacak (Faz 13). Collector, emakfabrika'nın kendi Next.js sürecinden AYRI
bir arka plan görevi olabilir (`TODO: COLLECTOR_PROCESS_MODEL` — aynı Node
sürecinde bir zamanlanmış görev mi, yoksa gerçekten ayrı bir süreç/konteyner
mi — fabrika sunucusunun kaynaklarına bağlı, Faz 13'te karar verilecek).
SNMP/ICMP/Agent/API adaptörleri `ElectronicDocumentProvider` ile AYNI adapter
deseniyle (`NetworkDiscoveryAdapter` arayüzü) kurulacak — madde 17'nin
istediği gibi, gerçek bir SNMP kütüphanesi bağlanana kadar bir
"NullDiscoveryAdapter" ile başlanacak (e-Belge'deki `NullElectronicDocumentProvider`
ile BİREBİR aynı desen).

## 9. RİSKLER

1. **Stok entegrasyonu boşluğu** (madde 46, 126) — PDF, yedek parça tüketiminin
   "Warehouse → Spare Part → Work Order → Consumption → Stock Movement"
   zincirinden geçmesini istiyor, ama emakfabrika'da HENÜZ bir Stok/Depo
   departmanı YOK (kullanıcının kendi sözü: "her departmanı ayrı PDF ile
   vereceğim"). `spare_parts` tablosu kendi basit stok sayacını tutacak
   (Faz 9'a kadar), gerçek bir Stok departmanı geldiğinde entegre edilecek —
   bu KASITLI bir ileri-uyumluluk kararı, geriye dönük kırılma riski taşımıyor
   çünkü `spare_parts.stock` alanı o zaman "warehouse'dan türetilen" bir
   alana dönüştürülebilir.
2. **Approval Engine** (madde 140) — "mevcut ERP workflow sistemiyle entegre
   çalışmalı, yeni bir approval engine oluşturup sistemi bölme" diyor, ama
   emakfabrika'da HENÜZ bir workflow/approval motoru YOK (Muhasebe'de de
   kurulmadı — dönem kapatma gibi işlemler basit izin kontrolüyle
   yapılıyor). Bu, IT'nin KENDİ ihtiyacı için basit bir onay motoru
   kurmasını GEREKTİRİYOR (madde 139, 173, 175'in Request→Approval
   akışları) — ama bu motor GENEL amaçlı yazılacak (yalnızca IT'ye özel
   değil), ki gelecekte başka departmanlar (Satın Alma, İK) da kullanabilsin.
   `TODO: APPROVAL_ENGINE_SCOPE` — Faz 6'da (Service Desk/Change Management)
   netleşecek.
3. **AI/Discovery/Agent güvenliği** (madde 113, 147-148) — gerçek bir
   endpoint agent'ının fabrikanın iç ağında çalışıp merkezi sisteme veri
   göndermesi, kimlik doğrulama/yetkilendirme açısından WEB kullanıcı
   oturumundan TAMAMEN farklı bir güven modeli gerektiriyor (agent
   kimlik bilgisi, cihaz-bazlı token, vb.) — bu, Faz 13'e kadar
   tasarlanmayacak, bugün yalnızca "ileride eklenebilir" olarak
   işaretleniyor (PDF'in kendi madde 17, 113 diliyle tutarlı).
4. **Kapsam riski** — Muhasebe'nin 100 maddesi ~3 gün sürdü (bu oturum
   içinde), IT'nin 211 maddesi kabaca 2 katı büyüklükte VE daha çok
   entegrasyon yüzeyi (network, monitoring, mobil, agent) içeriyor.
   Kullanıcının "en küçük detayına düşünülerek" talebi doğru ve ciddiye
   alınıyor — ama gerçekçi olarak bu, TEK bir oturumda değil, Muhasebe'de
   olduğu gibi faz faz, her fazda gerçek test ile ilerleyecek.

## 10. DEVELOPMENT PHASES (PDF madde 201'den, emakfabrika'ya uyarlanmış)

| Faz | İçerik | Durum |
|---|---|---|
| 1 | Existing ERP Analysis | ✅ Bu belge |
| 2 | IT Domain Architecture | ✅ Bu belge + companion doküman seti |
| 3 | Database + Auth genişletme (IT rolleri/izinleri, secret vault) | Sıradaki |
| 4 | Asset Management | — |
| 5 | CMDB | — |
| 6 | Service Desk | — |
| 7 | Ticket / Incident | — |
| 8 | Field Service | — |
| 9 | Maintenance | — |
| 10 | License / Warranty / Contract | — |
| 11 | IPAM / Network | — |
| 12 | Network Diagram | — |
| 13 | Monitoring | — |
| 14 | Server / VM | — |
| 15 | Knowledge Base | — |
| 16 | Reports / Dashboard | — |
| 17 | Mobile | — (bkz. §7, strateji kararı bekleniyor) |
| 18 | AI | — |
| 19 | Security / Compliance | — |
| 20 | Production Hardening | — |

Her fazdan sonra: migration, seed, testler (unit/integration/API/security/
tenant-izolasyon), dokümantasyon güncelleme, type check, lint, build —
Muhasebe'de kurulan disiplinin AYNISI (PDF madde 202).
