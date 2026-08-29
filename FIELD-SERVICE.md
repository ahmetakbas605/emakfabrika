# FIELD-SERVICE.md

Faz 8 kapsamı. Şema: IT-ARCHITECTURE.md §3 (`work_orders`,
`work_order_assignments`, `work_order_checklists`, `work_order_parts`,
`field_visits`, `technician_locations`).

## 1. Work Order = saha versiyonlu Ticket

Bir `service_desk_tickets` satırı `ticket_type='FIELD_SERVICE'` olduğunda
bir `work_orders` satırı (1:1, `ticket_id` FK) açılır — saha-özel alanları
(varış kanıtı, konum, imza) taşır. SERVICE-DESK.md'deki TAM durum makinesi
(ASSIGNED→ACCEPTED→ON_THE_WAY→ARRIVED→INSPECTION→WORKING→...) zaten saha
işleri için tasarlanmıştı — work_orders bu geçişlerin saha-özel YAN
verisini (konum, foto, imza) taşıyan bir EK tablo, durum makinesinin
KENDİSİ tekrarlanmıyor.

## 2. Konum takibi (madde 40-41)

```
technician_locations (id, user_id FK, work_order_id FK NULL, latitude,
  longitude, recorded_at, source ENUM('ARRIVAL_BUTTON','CONTINUOUS'))
```

PDF'in kendi kısıtı: "konum takibini varsayılan sürekli yapma — iş aktifken
ve şirket politikası izin verdiğinde." Bu, `companies` tablosuna (ya da
yeni bir `it_policies` tablosuna, bkz. §6) bir `continuous_location_tracking
_enabled` bayrağı gerektiriyor — KAPALI varsayılan, yalnızca `ARRIVED`
butonuna basıldığında TEK bir konum kaydı (source='ARRIVAL_BUTTON') alınır;
sürekli takip AÇIKÇA açılmadıkça hiç çalışmaz. KVKK açısından bu varsayılan
("minimal veri") kritik — PDF madde 88, 132 ile tutarlı.

## 3. Checklist (madde 34, 65-66, 106)

```
checklist_templates (id, company_id FK, code UNIQUE, name)  -- SERVER_MONTHLY_MAINTENANCE vb.
checklist_template_items (id, template_id FK, label, order_index)
work_order_checklists (id, work_order_id FK, template_id FK NULL)  -- şablonsuz da olabilir
work_order_checklist_items (id, checklist_id FK, label, checked BOOLEAN, note, checked_at, checked_by FK)
```

Şablon KOPYALANIR (work_order_checklist_items, template_item'lardan bir
KEZ kopyalanır) — şablon SONRADAN değişse bile geçmiş work order'ların
checklist'i DEĞİŞMEZ (Muhasebe'nin "mevzuat değişse bile eski kayıt eski
kurala göre kalır" ilkesiyle AYNI mantık, madde 76'nın genel prensibi).

## 4. Parça kullanımı → Stok (madde 46-47, 126)

```
work_order_parts (id, work_order_id FK, spare_part_id FK, quantity,
  serial NULL, unit_cost DECIMAL(20,6), consumed_at, consumed_by FK)
```

IT-ARCHITECTURE.md §9'daki Risk 1 (stok entegrasyonu boşluğu) burada somut
hâle geliyor: `spare_parts.stock` bugün KENDİ basit sayacı (yalnızca
`spare_parts` tablosunda bir INT alan, INSERT/UPDATE ile azaltılır) —
gerçek bir Depo/Stok departmanı geldiğinde `work_order_parts` satırının
`consumed_at`'ı bir "stok çıkış hareketi" event'ine dönüştürülebilir
(ACCOUNTING-ENGINE.md §1'in event-driven prensibiyle uyumlu bir gelecek
genişleme noktası, bugün kod YAZILMIYOR, yalnızca bu ayrım gözetiliyor).

## 5. Billable/Faturalama (madde 144-145)

`work_order_parts.unit_cost` + `work_order_time_logs` (work_log'un
billable/non_billable ayrımı) → Muhasebe'ye AKTARILABİLİR bir "fatura
taslağı" üretebilir, ama emakfabrika'da HENÜZ bir Satış/Fatura departmanı
YOK (Muhasebe departmanı yalnızca muhasebe kaydı yapıyor, satış faturası
KESMİYOR — bkz. ACCOUNTING-ENGINE.md'nin kapsamı, Satış ayrı bir departman
PDF'i bekliyor). Bu yüzden billable work, bugün yalnızca bir BAYRAK
(`billable BOOLEAN`) olarak saklanıyor, gerçek faturalama zinciri Satış
departmanı geldiğinde kurulacak — `TODO: SALES_DEPARTMENT_INTEGRATION`.

## 6. Servis Raporu (madde 142-143)

`generateServiceReport(workOrderId)` — work order + checklist + parts +
photos + signature + test sonuçlarını TEK bir PDF'e derler. Muhasebe'nin
`lib/e-document/provider.ts`'teki gibi bir "tek sağlayıcı" gerekmiyor
(bu PDF üretimi GİB'e gönderilmiyor, saf bir rapor) — Node tarafında bir
PDF kütüphanesi (`TODO: PDF_LIBRARY_CHOICE`, emakadroid'in
`expo-print`'ine web tarafının karşılığı, ör. `@react-pdf/renderer` ya da
headless Chrome — Faz 8'de karar verilecek) ile üretilir.
