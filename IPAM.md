# IPAM.md

Faz 11 kapsamı. IP Address Management — madde 9-11.

## 1. Subnet tanımlama → IP genişletme

```
network_subnets (id, company_id FK, branch_id FK NULL, cidr VARCHAR
  (ör. "192.168.1.0/24"), gateway, dns_primary, dns_secondary,
  vlan_id FK NULL, dhcp_enabled BOOLEAN, description, created_at)

ip_addresses (id, subnet_id FK, ip_address VARCHAR (ör. "192.168.1.1"),
  ip_version ENUM('IPV4','IPV6'), status ENUM('AVAILABLE','ASSIGNED',
  'RESERVED','CONFLICT','BLOCKED','UNKNOWN'), UNIQUE(subnet_id, ip_address))
```

Bir `network_subnets` satırı oluşturulduğunda, madde 10'un istediği "192.168.1.1
...254 hepsi yönetilebilir olmalı" — **karar:** tüm 254 adres satırı
OTOMATİK ÖNCEDEN OLUŞTURULMAZ (bu, /16 gibi büyük bloklarda 65.000+ satır
demek, gereksiz depolama). Bunun yerine `ip_addresses` yalnızca GERÇEKTEN
ATANMIŞ/REZERVE/ÇAKIŞAN adresler için satır tutar; "boş" (AVAILABLE) bir
adres UI'de HESAPLANARAK gösterilir (CIDR aralığından, o anda `ip_addresses`
tablosunda OLMAYAN her adres = available). Bu, madde 10'un görsel/işlevsel
isteğini (tüm aralığın yönetilebilir olması) DB satırı israfı olmadan
karşılıyor — `TODO: IP_RANGE_DISPLAY_STRATEGY` netleştirildi bu şekilde,
ama gerçek UI'de performans sorunu çıkarsa (çok büyük subnet'lerde sayfalama
gerekebilir) Faz 11'de gözden geçirilecek.

## 2. IP atama

```
ip_assignments (id, ip_address_id FK, asset_id FK NULL (it_assets),
  network_interface_id FK NULL, assigned_at, released_at NULL,
  assignment_type ENUM('STATIC','DHCP','RESERVED'))
```

Bir `ip_addresses.status='ASSIGNED'` olması İÇİN aktif (released_at IS NULL)
bir `ip_assignments` satırı OLMASI ZORUNLU — bu, uygulama-katmanında
`assignIp()`/`releaseIp()` fonksiyonlarıyla TEK yerden yönetilir, status
alanı elle güncellenmez (tutarsızlık riski).

## 3. IP çakışma kontrolü (madde 11)

```
detectIpConflict(ipAddressId):
  aynı ip_address_id için AKTİF (released_at IS NULL) BİRDEN FAZLA
  ip_assignments satırı var mı → varsa status='CONFLICT' işaretlenir +
  IT yöneticisine bildirim (it_notifications, Faz 3 sonrası kurulacak
  bildirim altyapısı)
```

Bu kontrol, `assignIp()` her çağrıldığında (yeni atama öncesi) çalışır —
zaten atanmış bir IP'ye ikinci bir atama YAPILMAK istenirse `AccountingError`
benzeri bir `ItError` ile ÖNCEDEN reddedilir; "IPAM mismatch" (madde 11,
network monitoring ile gerçek kullanım farkı) ise Monitoring modülünün
(MONITORING.md) ayrı bir uzlaştırma (reconciliation) işidir — IPAM kendi
kayıtlarını "doğru" varsayar, monitoring'in gördüğü gerçek trafik farklıysa
bir UYARI üretir, IPAM verisini OTOMATİK DÜZELTMEZ (insan onayı gerekir).

## 4. MAC Address (madde 12)

`mac_addresses` ayrı bir tablo DEĞİL — `network_interfaces.mac_address`
zaten bu bilgiyi taşıyor (NETWORK.md §1). PDF'in `mac_addresses` tablo
önerisi (madde 98) burada `network_interfaces`'e KONSOLİDE edildi
(gereksiz abstraction/duplikasyon önleme, madde 67).

## 5. IPAM raporlama

Global search (madde 159, "192.168.1.25" arandığında hangi cihaz/kullanıcı/
switch port/VLAN/ticket/lokasyon) — `ip_addresses` → `ip_assignments` →
`it_assets`/`network_interfaces` → `it_locations` JOIN zinciri, Faz 16'da
(Reports/Dashboard) gerçek arama endpoint'i olarak kodlanacak.
