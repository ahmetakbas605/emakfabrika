# NETWORK.md

Faz 11-12 kapsamı: Network Devices, Network Diagram, VLAN. IPAM ayrı
belgede (IPAM.md), Monitoring ayrı belgede (MONITORING.md) — bu belge
cihaz envanteri + topoloji + VLAN'a odaklanır.

## 1. Network Device (madde 3, 12)

`it_assets` (asset_type_code IN 'FIREWALL','ROUTER','SWITCH','ACCESS_POINT')
ZATEN network cihazlarını kapsıyor (IT-DATABASE.md §3) — AYRI bir
`network_devices` tablosu YOK, `it_assets`'in kendisi. `network_interfaces`
(madde 12) her cihazın portlarını taşır:

```
network_interfaces (id, asset_id FK (it_assets), name, mac_address,
  interface_type ENUM('ETHERNET','FIBER','WIFI'), switch_port_id FK NULL
  (self-referans, hangi switch portuna bağlı), vlan_id FK NULL, status)
```

Bir cihazın BİRDEN FAZLA interface'i olabilir (madde 12) — bu yüzden
`it_assets` üzerinde tek bir MAC/IP alanı YOK, hepsi `network_interfaces`
+ `ip_addresses` (IPAM.md) üzerinden.

## 2. VLAN (madde 13)

```
network_vlans (id, company_id FK, branch_id FK NULL, vlan_id INT,
  name, description, subnet_id FK NULL (ip_addresses'teki subnet kaydı),
  gateway, dhcp_enabled BOOLEAN, purpose, network_zone, security_level,
  UNIQUE(company_id, branch_id, vlan_id))
```

## 3. Network Diagram (madde 14-16)

DATABASE-ARCHITECTURE.md'nin genel ilkesiyle AYNI: "topology'yi sadece
frontend canvas state olarak saklama." IT-ARCHITECTURE.md §3'teki
`network_diagrams`/`network_nodes`/`network_links`/`network_diagram_versions`:

```
network_diagrams (id, company_id FK, name, current_version_id FK NULL)
network_diagram_versions (id, diagram_id FK, version_no INT, created_by FK, created_at)
network_nodes (id, diagram_version_id FK, node_type ENUM('FIREWALL','ROUTER',
  'SWITCH','SERVER','ACCESS_POINT','PRINTER','COMPUTER','CAMERA','NVR',
  'INTERNET','CLOUD'), linked_asset_id FK NULL (it_assets — INTERNET/CLOUD
  gibi soyut düğümlerde NULL), position_x, position_y)
network_links (id, diagram_version_id FK, source_node_id FK, target_node_id FK,
  port, vlan_id FK NULL, bandwidth, interface_name)
```

Her kayıt VERSİYONLANIR (madde 16) — yeni bir düzenleme YENİ bir
`network_diagram_versions` satırı açar, ESKİ versiyon SİLİNMEZ (Muhasebe'nin
financial immutability ilkesiyle AYNI disiplin, burada "network konfigürasyon
geçmişi" için). `network_diagrams.current_version_id` hangi versiyonun
"aktif/görüntülenen" olduğunu gösterir.

## 4. Canvas UI (madde 14)

Sürükle-bırak canvas — `TODO: CANVAS_LIBRARY_CHOICE` (React tabanlı bir
diyagram kütüphanesi, ör. `reactflow` — Faz 12'de, gerçek UI çalışması
başladığında seçilecek, bugün yalnızca veri modeli hazırlanıyor).

## 5. Network Dokümantasyonu (madde 71)

Ayrı bir tablo GEREKMİYOR — cihaz+IP+MAC+port+VLAN+rack+location+uplink
ilişkileri zaten yukarıdaki tablolardan (network_interfaces + ip_addresses
+ it_locations) TÜRETİLEBİLİR bir görünüm (rapor sorgusu), veri
DUPLIKASYONU yaratmıyor.

## 6. Network Discovery adapter (madde 17)

IT-ARCHITECTURE.md §8'de bahsedilen `NetworkDiscoveryAdapter` arayüzü —
`lib/e-document/provider.ts` ile AYNI desende:

```ts
interface NetworkDiscoveryAdapter {
  readonly method: 'SNMP' | 'ICMP' | 'ARP' | 'LLDP' | 'CDP' | 'API' | 'AGENT';
  discover(target: string): Promise<DiscoveredDevice[]>;
}
```

Bugün yalnızca `NullDiscoveryAdapter` (her çağrıda "henüz yapılandırılmadı"
hatası) — gerçek SNMP/ICMP kütüphanesi bağlanması Faz 13'ün (Monitoring)
bir parçası, bu belge yalnızca arayüzü şimdiden sabitliyor ki ileride
gerçek implementasyon eklenince ÇAĞIRAN KOD değişmesin.
