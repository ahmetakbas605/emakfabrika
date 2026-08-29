# IT-DATABASE.md

MySQL 8.4, aynı fabrika veritabanı (DATABASE-ARCHITECTURE.md kararları
AYNEN geçerli: CHAR(36) UUID, `{ mode: 'string' }` date/decimal, uygulama-
katmanı `companyId` filtresi). Bu belge Faz 3-5'in (Database + Asset + CMDB)
somut şema tasarımını içerir — sonraki fazların şeması kendi companion
dokümanlarında (NETWORK.md, MONITORING.md, vb.) detaylandırılacak.

## 1. Lokasyon hiyerarşisi (PDF madde 163-165)

Muhasebe'nin `company`/`branch`'i YETERSİZ — IT, `building/floor/room/rack/
desk` seviyesine kadar iniyor:

```
it_locations (
  id, company_id FK, branch_id FK NULL,
  parent_location_id (self-FK — building→floor→room→rack→desk zinciri),
  location_type ENUM('BUILDING','FLOOR','ROOM','RACK','DESK','DATA_CENTER'),
  name, rack_units INT NULL (yalnızca RACK tipi için, ör. 42),
  created_at
)
```

`branches` tablosunun ALTINA yeni bir hiyerarşi olarak ekleniyor — `branches`
DEĞİŞTİRİLMİYOR (mevcut tabloyu bozmama kuralı).

## 2. Departman türü + rol/izin seed (Faz 3)

```sql
INSERT INTO department_types (code, name) VALUES ('IT', 'Bilgi Teknolojileri');
```

Yeni izinler (mevcut 11'e ek): `assign`, `configure`, `monitor`,
`manage_credentials`, `manage_assets`, `manage_network`. `manage_users`
PDF'de var ama emakfabrika'da kullanıcı yönetimi zaten `requireFactoryAdmin`
seviyesinde — IT rolüne AYRICA verilmeyecek (TENANT-ARCHITECTURE.md ile
tutarlı, kullanıcı/departman ataması fabrika yöneticisinin işi).

Roller (IT-ARCHITECTURE.md §6'daki liste) + başlangıç `role_permissions`
matrisi (ACCOUNTING'deki ACCOUNTING_MANAGER/ACCOUNTANT/AUDITOR üçlüsüne
paralel): `IT_MANAGER` (tam yetki), `SERVICE_DESK_AGENT` (view/create/
update/assign/close ticket, asset'e yalnızca view), `NETWORK_ENGINEER`
(network+ipam'de tam, ticket'ta view), `FIELD_TECHNICIAN` (kendi work
order'larında update, genelde mobil üzerinden), `AUDITOR` (salt view+export).

## 3. IT Asset (Faz 4)

```
it_asset_types (code PK, name)  -- Desktop/Laptop/Server/Firewall/... (madde 3 listesi, seed)

it_assets (
  id, company_id FK, branch_id FK NULL, location_id FK NULL (it_locations),
  department_id FK NULL (hangi departmana zimmetli — Muhasebe/Satış/vb.),
  asset_type_code FK (it_asset_types),
  asset_tag VARCHAR UNIQUE (company_id, asset_tag),
  name, manufacturer, model, serial_number,
  status ENUM('IN_STOCK','ASSIGNED','INSTALLED','IN_SERVICE',
              'UNDER_MAINTENANCE','REPAIR','LOST','STOLEN','RETIRED',
              'DISPOSED') -- madde 6'daki lifecycle, REQUESTED/ORDERED/
              -- RECEIVED satın alma AŞAMASI ayrı bir "asset_requests"
              -- akışında (Faz 10/satın alma entegrasyonu), asset satırı
              -- ancak RECEIVED sonrası açılıyor
  owner_user_id FK NULL (it_users → mevcut users.id),
  responsible_technician_id FK NULL (users.id),
  purchase_date, purchase_cost DECIMAL(20,6), current_value DECIMAL(20,6),
  warranty_start, warranty_end,
  supplier_vendor_id FK NULL (vendors, Faz 10'da açılacak),
  last_inventory_scan_at, last_heartbeat_at,
  created_at, updated_at
)

it_asset_assignments (  -- madde 8, kullanıcı-cihaz N:N geçmişi
  id, asset_id FK, user_id FK, assigned_at, returned_at NULL,
  assignment_type ENUM('PERMANENT','TEMPORARY','SHARED'),
  assigned_by FK (users.id), reason
)

it_asset_status_history (  -- her durum geçişi audit_logs'a EK OLARAK burada da
  id, asset_id FK, from_status, to_status, changed_by FK, note, created_at
)
```

Bilgisayara özgü alanlar (madde 7-10 — CPU/RAM/OS/MAC/IP/antivirus/encryption)
`it_assets`'e DOĞRUDAN eklenmiyor (Firewall'da CPU alanı anlamsız) —
`computer_details` (1:1, `asset_id` FK) ayrı bir tabloda, yalnızca
`asset_type_code IN ('DESKTOP','LAPTOP','SERVER')` olan satırlar için
doldurulur. Bu, PDF'in kendi "gereksiz abstraction oluşturma" ile
"her cihaz tipi farklı alan seti" ihtiyacı arasındaki dengeyi kuruyor —
tek dev tablo yerine, tip-özel alan grupları ayrı tablolarda (server-specific
alanlar için de aynı desen: `server_details`).

## 4. CMDB (Faz 5)

```
configuration_items (
  id, company_id FK,
  ci_type ENUM('ASSET','SERVICE','APPLICATION','DATABASE') -- madde 168-169
    -- Business Service kavramı burada — bir CI mutlaka bir it_assets
    -- satırına karşılık gelmez (ör. "ERP Service" bir CI'dır ama fiziksel
    -- bir asset değildir)
  linked_asset_id FK NULL (it_assets — ci_type='ASSET' ise dolu),
  name, ci_key VARCHAR UNIQUE (company_id, ci_key) -- "SERVER-001" gibi
  status, created_at, updated_at
)

ci_relationships (
  id, source_ci_id FK, target_ci_id FK,
  relationship_type ENUM('DEPENDS_ON','RUNS_ON','CONNECTED_TO','HOSTED_ON',
    'LOCATED_IN','OWNED_BY','USED_BY','BACKED_UP_BY','MONITORED_BY',
    'PROTECTED_BY','LICENSED_BY','SUPPORTED_BY','CONTRACTED_BY',
    'PARENT_OF','CHILD_OF'), -- madde 99
  created_at
)
```

**`TODO: CI_ASSET_RELATIONSHIP` kararı burada verildi:** her `it_assets`
satırı OTOMATİK olarak bir `configuration_items` satırına sahip OLMAYACAK —
yalnızca CMDB ilişki grafiğinde yer alması GEREKEN varlıklar (sunucular,
network cihazları, kritik iş istasyonları) CI olarak işaretlenir. 500 sıradan
masaüstü bilgisayarın hepsini CI grafiğine sokmak (madde 167 "dependency
map") gürültü yaratır — CI'lar, dependency/impact analizi YAPILMASI
GEREKEN varlıklar için. Bu, `it_assets.status`/tipi bazlı bir kural değil,
IT yöneticisinin bilinçli seçimi (bir asset'i "CMDB'ye ekle" butonuyla
CI'ya dönüştürmesi).

## 5. Business Impact (madde 169-170)

```
business_services (id, company_id FK, name, criticality ENUM('LOW','MEDIUM','HIGH','CRITICAL'))
business_service_cis (business_service_id FK, ci_id FK)  -- N:N
```

Bir CI arızalandığında etkilenen `business_services` → oradan `impact_score`
hesaplanır (`affected_user_count` gibi türetilmiş bir alan, gerçek zamanlı
hesaplanır, saklanmaz — PDF madde 87'nin "gereksiz tarama yapma" ilkesiyle
tutarlı, ama bu düşük hacimli bir sorgu, mizan gibi ağır değil).

## 6. Index stratejisi (PDF madde 193)

`it_assets(company_id, asset_tag)`, `(company_id, serial_number)`,
`computer_details(hostname)`, `computer_details(ip_address)` (ama IP artık
Faz 11'de `ip_addresses` tablosunda merkezi tutulacak, `computer_details`
üzerinde DUPLICATE bir IP alanı olmayacak — tek gerçek kaynak `ip_addresses`),
`mac_addresses(mac)`, ticket tabloları için `(company_id, ticket_no)`,
`(status)`, `(priority)`, `(assigned_to)`, `(sla_due_at)` — bunlar Faz 6'da,
gerçek ticket şeması yazılırken eklenecek.

## 7. Soft delete / immutability (PDF madde 150, 54)

Muhasebe'nin "asla fiziksel silme, `status`/`cancelled_at`" ilkesi IT'nin
DENETİM açısından önemli tabloları için de geçerli: `it_assets` (RETIRED/
DISPOSED zaten birer status), `service_desk_tickets` (CLOSED, asla DELETE),
`audit_logs`/`it_asset_status_history` (hiç UPDATE/DELETE yok, yalnızca
INSERT). Monitoring metrikleri gibi düşük-değerli/yüksek-hacimli veriler
İSTİSNA — retention policy'ye göre gerçekten silinebilir (MONITORING.md).
