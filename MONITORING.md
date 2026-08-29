# MONITORING.md

Faz 13 kapsamı — IT-ARCHITECTURE.md §8'de tanıtılan mimari prensibin
(monitoring core'u ERP transaction DB'sinden ayır) somut tasarımı.

## 1. Collector/Agent mimarisi (madde 101)

```
MONITORING SERVER (emakfabrika'nın kendi süreci veya ayrı bir işlem — TODO:
  COLLECTOR_PROCESS_MODEL)
  ↓
COLLECTOR (zamanlanmış görev — TODO: SCHEDULER_INFRASTRUCTURE, SERVICE-DESK.md
  §8'de de aynı ihtiyaç var, TEK bir scheduler altyapısı ikisini de besleyecek)
  ↓
SNMP / ICMP / AGENT / API (NetworkDiscoveryAdapter — NETWORK.md §6)
  ↓
DEVICE (it_assets)
  ↓
METRICS (monitoring_metrics)
  ↓
ALERT ENGINE (eşik karşılaştırma — monitoring_alerts)
  ↓
INCIDENT (madde 76 zinciri — SERVICE-DESK.md'deki incidents tablosu)
  ↓
SERVICE DESK
```

## 2. Şema

```
monitoring_targets (id, company_id FK, asset_id FK (it_assets),
  target_type ENUM('PING','SNMP','SERVICE','PORT'), config JSON
  (SNMP community/OID gibi — ŞİFRELENMİŞ referans, plaintext DEĞİL, bkz.
  IT-SECURITY.md §2), interval_seconds INT, active BOOLEAN)

monitoring_metrics (id, target_id FK, metric_name VARCHAR (ör. 'cpu_percent',
  'latency_ms', 'packet_loss_percent'), value DECIMAL(20,6), recorded_at
  TIMESTAMP, PARTITION BY RANGE (recorded_at) -- aylık partition, §4)

monitoring_alerts (id, target_id FK, severity ENUM('CRITICAL','HIGH','MEDIUM',
  'LOW','INFO'), message, status ENUM('OPEN','ACKNOWLEDGED','RESOLVED'),
  correlation_group_id CHAR(36) NULL (§3), incident_id FK NULL, created_at)
```

## 3. Alert Correlation (madde 78)

Aynı `target_id`'den kısa sürede (`TODO: CORRELATION_WINDOW_SECONDS`,
önerilen: 300 saniye) birden fazla alert gelirse, İLK alert bir
`correlation_group_id` (yeni UUID) ile açılır, SONRAKİ alert'ler AYNI
grubu paylaşır (yeni bir `monitoring_alerts` satırı YİNE açılır — ham veri
kaybolmaz — ama `→ Incident` zinciri yalnızca grubun İLK alert'i için
tetiklenir, aynı gruptaki sonraki alert'ler MEVCUT incident'a bir yorum/
work_log olarak eklenir, YENİ bir incident AÇMAZ).

## 4. Time Series stratejisi (madde 102-103, 149)

`monitoring_metrics` MySQL'in native `PARTITION BY RANGE` özelliğiyle aylık
partition'lanır (`recorded_at`'ın yıl-ay'ına göre). Retention job (scheduler
altyapısının bir görevi): ham metrik 30 gün sonra SİLİNİR (partition DROP —
milyonlarca satırı DELETE ile silmek yerine, tüm bir partition'ı bir kerede
düşürmek MySQL'de çok daha ucuz), 30 günden eski veri için `monitoring_metrics_
daily_agg` (saatlik/günlük ortalama-min-max) tablosuna ÖNCEDEN aggregate
edilir, o tablo 1 yıl saklanır. `availability` (uptime/downtime toplamı) AYRI,
uzun-dönem saklanan bir özet tablo (`monitoring_availability_daily`).

## 5. SLA/Uptime hesaplama (madde 79)

```
monitoring_availability_daily (id, target_id FK, date, uptime_seconds,
  downtime_seconds, availability_percent DECIMAL(5,2))
```

Her gün sonunda (scheduler) o günün `monitoring_metrics`'inden (ping
başarı/başarısızlık serisi) hesaplanıp buraya YAZILIR — Muhasebe'nin
`getTrialBalance`'ının "asla ham tabloyu her seferinde tarama" ilkesiyle
AYNI mantık (madde 87), burada zaman-serisi versiyonu.

## 6. Backup Management (madde 75)

```
backup_jobs (id, company_id FK, asset_id FK, source, destination, schedule
  CRON_EXPR, retention_days, encryption BOOLEAN)
backup_results (id, backup_job_id FK, started_at, finished_at, result
  ENUM('SUCCESS','FAILED','PARTIAL'), size_bytes, verification_status, error_message)
```

`result='FAILED'` → OTOMATİK bir `monitoring_alerts` satırı (severity='HIGH')
üretir → aynı zincirden Incident'a gidebilir (madde 75'in kendi isteği).

## 7. Eventual Consistency (madde 196)

`monitoring_metrics` yazımı GÜÇLÜ transaction consistency GEREKTİRMİYOR
(bir metrik satırının kaybolması kritik değil, sonraki ölçüm zaten gelir) —
bu tablo `postJournal`'ın transaction disiplinine TABİ DEĞİL, düz INSERT.
Finansal/stok işlemlerinde (Muhasebe, gelecekteki Stok departmanı) bu
gevşeklik ASLA uygulanmaz — bu ayrım BİLİNÇLİ ve dokümante, karıştırılmasın
diye burada AÇIKÇA yazılıyor.
