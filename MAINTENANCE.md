# MAINTENANCE.md

Faz 9 kapsamı — madde 61-67.

## 1. Şema

```
maintenance_plans (id, company_id FK, asset_id FK NULL (it_assets — NULL ise
  genel/lokasyon bazlı bakım, ör. "tüm ofis yazıcıları"), maintenance_type
  ENUM('PREVENTIVE','CORRECTIVE','PREDICTIVE','INSPECTION','CALIBRATION'),
  frequency ENUM('DAILY','WEEKLY','MONTHLY','QUARTERLY','ANNUAL'),
  interval_value INT (ör. frequency=MONTHLY, interval=1 → her ay; interval=3
  → 3 ayda bir), start_date, next_due_date, assigned_team_id FK NULL,
  assigned_technician_id FK NULL, checklist_template_id FK NULL
  (FIELD-SERVICE.md §3'teki checklist_templates — AYNI tablo, tekrar
  oluşturulmuyor), sla_policy_id FK NULL, estimated_duration_minutes)

maintenance_work_orders (id, maintenance_plan_id FK, work_order_id FK
  (work_orders — FIELD-SERVICE.md'deki AYNI tablo, bakım işi de bir work
  order'dır), scheduled_date, generated_at)
```

## 2. Otomatik work order üretimi (madde 62-63)

Scheduler (SERVICE-DESK.md §8, MONITORING.md §4 ile PAYLAŞILAN altyapı) her
gün çalışan bir görev: `maintenance_plans.next_due_date <= today` olan
planlar için OTOMATİK bir `work_orders` + `maintenance_work_orders` satırı
açar, `next_due_date`'i bir sonraki periyoda İLERLETİR (frequency+interval'a
göre). Bu iş İKİ KEZ ÇALIŞTIRILSA BİLE aynı gün için ikinci bir work order
AÇMAMALI — `UNIQUE(maintenance_plan_id, scheduled_date)` kısıtı
`maintenance_work_orders` üzerinde bu garantiyi sağlar (Demirbaş'ın
"ay başına bir amortisman" desenindeki AYNI korumanın burada tekrarı).

## 3. Checklist template'leri (madde 66)

`SERVER_MONTHLY_MAINTENANCE`, `FIREWALL_MONTHLY_MAINTENANCE`,
`NETWORK_ANNUAL_MAINTENANCE`, `PC_ANNUAL_MAINTENANCE`, `PRINTER_MAINTENANCE`
— seed olarak eklenecek `checklist_templates` satırları (FIELD-SERVICE.md
§3'teki tabloyu kullanır), her biri madde 65'teki örnek maddelerle
(`checklist_template_items`).

## 4. Bakım tamamlanması → CMDB güncellemesi

Bir `maintenance_work_orders`'a bağlı work order `CLOSED` olduğunda,
ilgili `it_assets.status` `UNDER_MAINTENANCE`'tan geri `IN_SERVICE`'e
döner (otomatik) — bu geçiş `it_asset_status_history`'e YAZILIR, madde 6'nın
"her cihazın yaşam döngüsünü takip et" ilkesiyle tutarlı.
