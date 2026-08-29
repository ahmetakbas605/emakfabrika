# CMDB.md

Şema: IT-DATABASE.md §4. Bu belge CMDB'nin DAVRANIŞINI (sorgu desenleri,
dependency graph, impact analizi) tanımlar.

## 1. CI oluşturma akışı

Bir `it_assets` satırı "CI'ya yükseltildiğinde" (IT-DATABASE.md §4'teki
bilinçli seçim), `configuration_items` satırı `linked_asset_id` ile açılır,
`ci_key` otomatik üretilir (PDF madde 5 örnekleri: `SERVER-001`,
`SWITCH-003` — asset_type_code'a göre önek + sayaç, Muhasebe'nin
`journal_number_counters` ATOMİK sayaç desenini tekrar kullanır: her
`asset_type_code` için ayrı bir sayaç satırı).

## 2. İlişki grafiği sorgusu

`ci_relationships` çift yönlü SORGULANABİLİR olmalı (bir CI'nın hem "neye
bağımlı olduğu" hem "kimin ona bağımlı olduğu") — bu yüzden ilişki HER ZAMAN
TEK yönde saklanır (`source_ci_id DEPENDS_ON target_ci_id`), sorgu katmanı
`getDependencies(ciId)` (source=ciId) ve `getDependents(ciId)` (target=ciId)
olarak İKİ ayrı fonksiyon sağlar — çift kayıt (hem A→B hem B→A) YAPILMAZ,
veri bütünlüğü riski taşır.

## 3. Dependency Map / Impact Analizi (madde 167, 169)

```
getImpactedServices(ciId):
  1. ciId'nin DEPENDS_ON zincirini TERSİNE (yani kimler ciId'ye bağımlı,
     getDependents) recursive olarak gez (max derinlik sınırı — TODO:
     MAX_TRAVERSAL_DEPTH, çevrimsel ilişkiye karşı koruma, önerilen: 10)
  2. Ulaşılan her CI için business_service_cis üzerinden business_services'i bul
  3. Her servis için criticality + business_services.affected_user_count
     (bu alan gerçek zamanlı hesaplanmaz, IT yöneticisi elle girer — "kaç
     kullanıcı bu servisi kullanıyor" bilgisi CMDB'nin kendi verisinden
     OTOMATİK türetilemez, TODO: USER_COUNT_SOURCE)
```

Çevrimsel ilişki koruması ZORUNLU — "A DEPENDS_ON B, B DEPENDS_ON A" gibi bir
veri girişi sonsuz döngüye sokabilir; traversal fonksiyonu ziyaret edilen
CI ID'lerini bir Set'te tutup tekrar ziyareti engeller.

## 4. Rack görünümü (madde 22, 163-165)

`it_locations` (location_type='RACK', rack_units) + `it_assets.location_id`
+ yeni bir alan `it_assets.rack_position` (INT, hangi U'da başladığı) +
`it_assets.rack_height_u` (kaç U kapladığı, ör. 1U/2U server). Rack görünümü
saf bir SORGU/render işi — ayrı bir tablo GEREKMİYOR (PDF madde 16'nın
network diagram'ı için istediği "sadece frontend state olarak saklama"
kuralı BURADA TERSİNE işliyor: rack yerleşimi zaten `it_assets` üzerinde
kalıcı alanlar, ayrı bir versiyon geçmişi gerektirmiyor — network diagram'ın
aksine, rack yerleşimi sık DEĞİŞMEYEN, tek "doğru" durumu olan bir veri).

## 5. Data Center / Power (madde 165-166)

```
power_distribution_units (id, company_id FK, location_id FK, name)
it_assets.pdu_id FK NULL, it_assets.ups_id FK NULL (self-referans, UPS de
  bir it_assets satırı — asset_type_code='UPS')
```

`SERVER-01 → PDU-A → UPS-01` zinciri iki ayrı FK ile (asset'in kendi
PDU/UPS'ine doğrudan referansı) kuruluyor — CMDB ilişki grafiğinde AYRICA
`POWERED_BY` tipi bir `ci_relationships` satırı da açılabilir (iki
mekanizma REDUNDANT görünse de amaçları farklı: FK hızlı sorgu için,
ci_relationships genel-amaçlı graph gezinme için — PDF'in "dependency map"
istekleri ikincisini gerektiriyor).

## 6. Test senaryosu (Faz 5 sonunda yazılacak)

`SERVER-001 DEPENDS_ON UPS-001`, `CONNECTED_TO SWITCH-001`,
`PROTECTED_BY FIREWALL-001`, `RUNS ERP-Database` (business service),
`MONITORED_BY Monitoring-Agent` (PDF madde 100'ün TAM senaryosu) — bu ilişki
seti kurulduktan sonra `getImpactedServices('SERVER-001')` çağrısı
`ERP-Database` servisini (ve onun criticality'sini) doğru döndürmeli. Bu,
Muhasebe'nin "gerçek hayat senaryosu" testleriyle AYNI disiplin.
