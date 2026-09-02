# MASTER-ERP-ROADMAP.md

"EMAKFABRİKA ERP — HOLDİNG + FABRİKA + SAHA + MOBİL" master prompt'unun
(156 madde) §144-146'sındaki faz şablonu, bu projenin GERÇEK mevcut durumuna
(bkz. [ARCHITECTURE-GAP-REPORT.md](./ARCHITECTURE-GAP-REPORT.md)) ve tenant
mimarisi kararına (bkz. [ASSUMPTIONS.md](./ASSUMPTIONS.md)) uyarlanmış hâli.
`ARCHITECTURE.md`'deki eski Faz 1-14 tablosu yalnızca Muhasebe departmanının
kendi kuruluş sürecini kapsıyordu ve o kapsam tamamlandı — bu belge onun
YERİNE geçen, tüm Holding ERP'yi kapsayan üst-seviye plan.

**Disiplin** (master prompt §106, §151, bu projenin HR/Procurement/Core-Security
turlarında zaten kanıtlanmış): her faz `Analysis→Domain Model→Database→
Migration→API→Business Logic→Workflow→Permission→Audit→Frontend→Mobile(gerekirse)
→Tests→Documentation` sırasıyla ilerler, gerçek DB üzerinde doğrulama scriptiyle
+ Playwright ile test edilir, `tsc --noEmit`+`npm run build` temiz olmadan
"tamamlandı" sayılmaz, kendi mimari belgesi (mevcut `IT-ARCHITECTURE.md` tarzı)
faz başında yazılır — 20 belgeyi baştan, boş şablon olarak üretmek yerine.

## Zaten teslim edilmiş (yeni iş YOK, yalnızca referans)

| Alan | Durum | Not |
|---|---|---|
| Core Platform (Auth/Org/RBAC/Session/MFA) | ✅ | `users`/`departments`/`roles`/`user_sessions` + bu oturumun Core Security eklentileri |
| Muhasebe/Finans/Bütçe/Sabit Kıymet | ✅ | `ACCOUNTING-ENGINE.md` |
| Depo/Stok | ✅ | `lib/warehouse.ts` |
| Satın Alma (Requisition→RFQ/Tender→Award→PO→Mal Kabul) | ✅ | `lib/procurement/` |
| İK (Employee Core→PDKS→İzin/Mesai→Erişim→Ücret/Prim) | ✅ | `project_emakfabrika_hr` (Faz 0-5) |
| IT/ITSM (CMDB/Ticket/Network/Monitoring/Backup) | ✅ | `IT-ARCHITECTURE.md` ve alt belgeleri |
| Core Security (Audit/MFA/Maskeleme/SoD/KVKK DSR) | ✅ | bu oturum |

## FAZ 0 — Tenant/Holding Sertleştirme ✅ (commit `b876855`)

**Bağımlılık:** yok — her şeyin altında. **Kapsam:**
- `holdings` tablosu (additive) + `companies.holdingId` FK; mevcut 4 test
  şirketi tek bir varsayılan holding'e bağlanır (geriye dönük uyumlu).
- Holding-seviyesi **konsolide raporlama** (salt-okunur agregasyon — mizan/
  bilanço'nun holding'deki TÜM şirketler için toplanmış hâli; muhasebe
  fişlerinin kendisi company-scope'lu kalır, `HOLDING_ACCOUNT_PLAN_SCOPE`
  TODO'sunun çözümü — bkz. ASSUMPTIONS.md §1.3).
- **İzolasyon sertleştirme**: 410 elle-yazılmış `companyId` filtresi yerine
  paylaşılan bir desen — gerçekçi seçenek, mevcut kod tabanının TAMAMINI
  yeniden yazmadan: (a) her `lib/*.ts` dosyasının ilk parametresinin
  `companyId` olması zorunluluğunu ESLint kuralıyla denetlemek (derleme-zamanı
  disiplin, RLS'in DB-zamanı garantisinin en yakın pratik karşılığı), (b)
  `requireDepartmentAccess`/`requireFactoryAdmin` gibi giriş noktalarında
  zaten var olan companyId-eşleşme kontrolünü tek bir merkezi yardımcıya
  çıkarmak (bugün her dal.ts fonksiyonunda ayrı ayrı yazılı), (c) master
  prompt §80'in "Tenant A → Tenant B" testini GERÇEK bir otomatik test
  paketine dönüştürmek (bugün yalnızca manuel/ad-hoc doğrulandı).
- Holding-seviyesi rol: `HOLDING_ADMIN` (master prompt §87) — bir holding'in
  TÜM şirketlerine, `isFactoryAdmin`'in tek-şirket sınırını aşan tam erişim.
- CEO/Holding Dashboard'un veri iskeleti (widget'ların kendisi Faz 13/BI'da).

## FAZ 1 — Satış & CRM ✅

**Bağımlılık:** Master Data (✅), Muhasebe (✅). **Neden şimdi:** MRP'nin talep
girdisi (§19: "Satış siparişleri + Tahmin") olmadan MRP anlamsız — master
prompt §145'in kendi bağımlılık zincirinin ilk halkası.

Teslim edilenler: `leads`→`opportunities`→`sales_quotes`(+lines)→
`sales_orders`(+lines, documentType='SALES_ORDER' jenerik onay motoruna
bağlı)→`sales_shipments`(+lines, onay sonrası opsiyonel stok rezervasyonu +
sevkiyatta gerçek stok çıkışı)→`sales_invoices`(+lines, opsiyonel muhasebe
entegrasyonu — Satınalma'nın vendor-invoice deseniyle AYNI)→
`sales_collections`→`customer_complaints`. **Müşteri kavramı** mevcut
`parties`+`CUSTOMER` rolünü YENİDEN KULLANDI (ayrı bir customers tablosu
AÇILMADI — §150 Single Source of Truth). **"Servis" bilinçli olarak dışarıda
bırakıldı** — mevcut IT Field Service altyapısıyla (work_orders) çakışmaması
için, gerçek entegrasyonu ayrı bir faz.

UI: `/dashboard/sales` (+leads/opportunities/quotes/orders/orders/[id]/
invoices/complaints), onay kutusuna (mevcut `/dashboard/approvals`) SALES_ORDER
onayı için opsiyonel depo seçici eklendi (yalnızca APPROVE'da tüketilir).

Test: `tests/sales.test.ts` (kalıcı) — tam Lead→Fırsat→Teklif→Sipariş→
Onay(+stok rezervasyonu)→Sevkiyat(+gerçek stok çıkışı)→Fatura(+gerçek muhasebe
fişi, KDV dahil)→Tahsilat(+gerçek Kasa/Banka fişi)→Şikayet zinciri, 17/17
gerçek DB üzerinde geçti (ondalık muhasebe matematiği dahil doğrulandı). Canlı
Playwright ile tüm yeni sayfalar + mevcut Onay Kutusu regresyonu doğrulandı.
`tsc --noEmit` + `npm run build` temiz.

## FAZ 2 — Üretim Çekirdeği (BOM + Routing + Production Order) ✅

**Bağımlılık:** Faz 1 (talep), Depo (✅), Satın Alma (✅ — malzeme tedariki).

Teslim edilenler: `work_centers`→`boms`(+lines, employee_contracts İLE AYNI
immutable versiyon zinciri, fire%/alternatif bileşen destekli)→`routings`
(+operations, opsiyonel)→`production_orders`(documentType='PRODUCTION_ORDER'
jenerik onay motoruna bağlı, onay ANINDA BOM bileşenleri o emrin deposunda
otomatik rezerve edilir + routing varsa her operasyon için bir
`prod_operations` satırı otomatik üretilir)→Malzeme Çıkışı (TEK, TAM tüketim
olayı — gerçek stok çıkışı + rezervasyonun GERÇEKTEN serbest bırakılması,
Satış Sevkiyatı'nın kısmi-sevkiyat nedeniyle bırakmadığı bir şeyi burada tam
tüketim olduğu için güvenle yapabildik)→İş Emri operasyonları (başlat/
tamamla, iyi/fire kaydı)→Üretim Tamamlama (tüm operasyonlar bitmeden
kilitli — mamul GERÇEK stok girişi + opsiyonel muhasebe fişi).

Mimari notlar:
- `prod_operations` tablo/sütun adları BİLİNÇLİ OLARAK kısa tutuldu — hem
  IT'nin zaten var olan `work_orders`/`wo_checklists` (saha servis) ile isim
  çakışmasın diye, hem de GERÇEK bir migration hatasıyla bulunan MySQL'in 64
  karakterlik FK-adı sınırını aşmamak için (`production_work_orders` +
  `production_order_id` + `production_orders` birleşince ER_TOO_LONG_IDENT
  verdi — schema.ts'in kendi yorumunda kayıtlı).
- Bir üretim emri her zaman ürünün O ANDA ACTIVE BOM/Routing'ini kullanır,
  kullanıcı versiyon SEÇMEZ — ama emrin kendi `bomId`/`routingId` alanları o
  ANKİ versiyona DONAR (geçmiş bir emrin reçetesi asla değişmez).
- Onay eşiği (`amount`) için gerçek maliyetlendirme (standart/gerçek
  maliyet) bu fazın kapsamı DIŞINDA — miktar kendisi eşik değeri olarak
  kullanılıyor, TODO not edildi.

Test: `tests/production.test.ts` (kalıcı) — tam İş Merkezi→BOM(%10 fire)→
Routing(2 operasyon)→Üretim Emri→Onay(+stok rezervasyonu doğru miktarda)→
Malzeme Çıkışı(+gerçek stok düşüşü +rezervasyon serbest bırakma +gerçek
muhasebe fişi)→Operasyon başlat/tamamla→Üretim Tamamlama(+gerçek mamul stok
girişi +gerçek muhasebe fişi) zinciri, 22/22 gerçek DB'de doğrulandı. Diğer
üç kalıcı test paketiyle (accounting/holding/sales) birlikte toplam 65/65.
Canlı Playwright ile tüm yeni sayfalar + mevcut modül regresyonu sıfır
hatayla doğrulandı. `tsc --noEmit` + `npm run build` temiz.

## FAZ 3 — MRP ✅

**Bağımlılık:** Faz 1+2 (✅). madde 19'un 5 girdisi — Tahmin ("forecast")
HARİÇ: hiçbir talep-tahmin altyapısı yok, sıfır veriyle hesaplamak anlamsız
sonuç üretirdi, TODO not edildi (BI/Faz 12 civarı gerçek bir tüketici
doğduğunda eklenecek).

`runMrp()`: Satış siparişi + Minimum stok (yeni `stock_items.minQty`,
opsiyonel) → ÇOK SEVİYELİ BOM patlatması (bir mamul için önerilen üretim,
kendi bileşenleri için yeni talep üretir, `parentId` ile izlenebilir,
MAX_EXPLOSION_DEPTH=10 dolaylı döngü koruması) → net ihtiyaç = brüt talep −
mevcut stok − açık üretim − açık satın alma (procPoLines'ın productId
TAŞIMADIĞI için procAwardLines→procRfqLines/procTenderLines LEFT JOIN
zinciriyle çözüldü). Öneriler `mrp_planned_orders`a SUGGESTED yazılır —
MRP HİÇBİR ZAMAN otomatik belge açmaz, kullanıcı her öneriyi GERÇEK bir
üretim emrine/satın alma talebine dönüştürür ya da iptal eder.

**GERÇEK bir tasarım hatası, planlama sırasında bulunup düzeltildi**: aynı
ürün BİRDEN FAZLA seviyede talep görebilir (ör. hem kendi minimum-stok
politikası var hem de başka bir mamulün bileşeni) — her seviyede mevcut
stoğu/açık siparişi SIFIRDAN sorgulamak, AYNI stoğu İKİ KEZ kredilendirip
toplamda EKSİK sipariş önerirdi. Düzeltme: her ürünün kullanılabilir arzı
(on-hand + açık üretim + açık satın alma) TEK SEFER hesaplanıp koşu boyunca
TÜKETİLDİKÇE azaltılan bir havuzda tutuluyor (gerçek MRP'lerin "low-level
coding" ile çözdüğü sorunun, bu ölçekte yeterli, daha basit bir eşdeğeri) —
`tests/mrp.test.ts` özellikle BU senaryoyu (paylaşılan havuz olmadan 49,
doğrusu 53) doğrulamak için tasarlandı.

Test: `tests/mrp.test.ts` (kalıcı) — 3 seviyeli BOM zinciri (P←2×S←3×R),
açık üretim netlemesi, paylaşılan-havuz düzeltmesinin doğruluğu, GERÇEK
üretim emrine/satın alma talebine dönüştürme, çift-dönüştürme reddi, iptal
— 16/16. Açık satın alma (procurement) netleme sorgusu, tam bir RFQ→Award→PO
zinciri kurmanın bu fazın kapsamına orantısız ek karmaşıklık katması
nedeniyle AYRI test edilmedi (kodu yazıldı/type-check'ten geçti, ama bu
belirli dal canlı bir DB senaryosuyla doğrulanmadı — dürüstçe not edildi).
Beş kalıcı test paketi (accounting/holding/sales/production/mrp) birlikte
81/81. Canlı Playwright ile tüm yeni sayfalar + mevcut modül regresyonu
(Sales/Production dahil) sıfır hatayla doğrulandı. `tsc --noEmit` +
`npm run build` temiz.

## FAZ 4 — MES ✅

**Bağımlılık:** Faz 2. Üretim emri/makine/operatör/duruş/arıza/OEE — PLC/
SCADA/IoT entegrasyonuna hazır event/API iskeleti (gerçek donanım entegrasyonu
KAPSAM DIŞI, master prompt §21 zaten "hazırlığa hazır ol" diyor, "entegre et"
demiyor).

**"Üzerine inşa et, çoğaltma" disiplini** (§150 Single Source of Truth):
Faz 2'nin `work_centers`/`prod_operations`'ı BİLİNÇLİ OLARAK yeniden
kullanıldı — operatör zaten `assignedToUserId`, iyi/fire zaten
`goodQuantity`/`scrapQuantity` olarak duruyordu, paralel bir "üretim sayacı"
tablosu AÇILMADI. Gerçekten yeni olan tek iki kavram: `machines` (work
center'dan daha ince taneli — bir iş merkezinde birden fazla makine olabilir)
ve `machine_downtimes` (Availability bileşenini besleyen, hiçbir mevcut
tabloda karşılığı olmayan tek gerçek yeni veri).

Teslim edilenler: `machines`(work_center'a bağlı, opsiyonel
`idealCycleTimeSeconds`)→`downtime_reasons`(sabit TS enum DEĞİL, departmentTypes
İLE AYNI desende seçilmiş/seed'lenmiş referans tablosu, 9 satır: 4 PLANNED +
5 UNPLANNED)→`machine_downtimes`(makine+opsiyonel operasyon+neden+başlangıç/
bitiş, `endedAt IS NULL`=hâlâ açık)→`startProdOperation`'a geriye uyumlu
opsiyonel `machineId` parametresi→OEE = Availability×Performance×Quality
(SAKLANAN bir tablo DEĞİL, `getOeeForOperation`/`getMachineOeeSummary` ile
TALEP ÜZERİNE hesaplanan rapor).

Mimari notlar:
- **Dürüst null'lar**: makinenin `idealCycleTimeSeconds`'ı boşsa Performance
  (dolayısıyla OEE) SESSİZCE %100 varsayılmaz — `null` döner, UI'da (hem
  MES panelinde hem Üretim Emri detayındaki OEE tooltip'inde) AÇIKÇA "makine
  ideal çevrim süresi tanımlı değil" olarak gösterilir.
- MySQL'in 64 karakterlik FK-adı sınırı (Faz 2'de `ER_TOO_LONG_IDENT` ile
  GERÇEKTEN bulunmuştu) bu kez migration ÜRETİLMEDEN ÖNCE tablo/kolon adları
  bilinçli kısa tutularak (`machine_downtimes`, `prod_operations.operation_id`
  değil `operation_id`) önlendi — `grep`+`awk` ile üretilen migration'daki
  TÜM constraint adları uygulanmadan önce doğrulandı (en uzunu 54 karakter).
- madde 21'in "entegrasyona hazır API" isteği ayrı bir event-bus soyutlaması
  icat EDİLMEDEN karşılandı: `recordDowntimeStart`/`recordDowntimeEnd` bir
  insanın UI'dan tıklamasıyla da, ileride bir PLC/OPC-UA köprüsünün
  programatik çağrısıyla da AYNI şekilde çalışır.

Test: `tests/mes.test.ts` (kalıcı) — makine+duruş+operasyon zinciri, kontrollü
(elle ayarlanmış) zaman damgalarıyla OEE'nin TAM matematiksel doğruluğu
(Availability=5/6, Quality=20/21, Performance=7/10, OEE=5/9) kanıtlandı;
makine OEE özetinin tekil operasyonla eşleştiği, ideal çevrim süresi
tanımsızken Performance/OEE=null döndüğü, aynı makinede ikinci açık duruşun
ve zaten kapatılmış bir duruşun tekrar kapatılmasının reddedildiği, tamamlanmamış
bir operasyon için OEE isteminin reddedildiği doğrulandı — 19/19 gerçek DB'de
geçti. Altı kalıcı test paketi (accounting/holding/sales/production/mrp/mes)
birlikte toplam 100/100. `tsc --noEmit` + `npm run build` temiz. Bu oturumda
canlı tarayıcı (Playwright/MCP) aracı erişilebilir DEĞİLDİ — yeni `/dashboard/
mes` ve `/dashboard/mes/machines/[machineId]` sayfaları yalnızca derleme/
type-check seviyesinde doğrulandı, canlı tıklama testi YAPILMADI; dürüstçe
not edilir, sonraki bir oturumda araç mevcutken tamamlanabilir.

## FAZ 5 — Kalite ✅

**Bağımlılık:** Faz 2. Giriş/proses/final kalite, NCR/CAPA/8D, tedarikçi
kalite (Satın Alma'nın tedarikçi kaydına bağlanır).

Teslim edilenler: `quality_inspections`(Giriş/Proses/Final, TEK adımda
kaydedilen bir gözlem — duruş kaydının başlat/bitir iki-adımlı deseninin
AKSİNE, bir muayenenin süresi anlamlı bir veri değil)→`ncr_records`
(NCR/CAPA, `customer_complaints`'in KENDİ deseniyle: status alanı + doğrudan
isimlendirilmiş-fiil aksiyon fonksiyonları, jenerik onay motoruna
BAĞLANMADI)→Tedarikçi Kalite (`getSupplierQualityScore`, `lib/mes/oee.ts`
İLE AYNI felsefe: SAKLANAN bir skor tablosu DEĞİL, talep üzerine hesaplanan
bir rapor).

Mimari notlar:
- `sourceType`/`sourceId` — `accounting_journals`/`stock_movements`/
  `inv_reservations`/`budget_commitments`'ın ZATEN kullandığı AYNI
  polimorfik desen, 3 farklı muayene kaynağı için 3 ayrı FK kolonu
  AÇILMADI: `'PROC_RECEIPT_LINE'` (Giriş, Satınalma'nın mevcut mal kabul
  satırı), `'PROD_OPERATION'` (Proses, Faz 2'nin operasyonu),
  `'PRODUCTION_ORDER'` (Final, Faz 2'nin üretim emri) — Kalite kendi
  paralel "üretim/mal kabul olayı" tablosunu AÇMADI (§150).
- "8D" 8 ayrı sabit kolon olarak ZORLANMADI — metodolojinin ismi literal 8
  alan gerektirmiyor (OEE'nin gerçek zamanlı her metriği saklamaması İLE
  AYNI "isme değil ihtiyaca göre modelle" kararı); `rootCause`/
  `correctiveAction`/`preventiveAction` üç metin alanı D4/D5-D6/D7'nin
  özünü karşılıyor.
- **Tedarikçi Kalite, ayrı bir "vendor" kaydı AÇMADAN** `parties`'in zaten
  var olan SUPPLIER rolüne (`ncr_records.supplierPartyId`) ve Satınalma'nın
  zaten var olan PO→Mal Kabul zincirine (Giriş muayenesi →
  `proc_receipt_lines` → `proc_receipts` → `proc_pos.supplierPartyId`
  JOIN zinciri) bağlanır — madde metninin "Satın Alma'nın tedarikçi
  kaydına bağlanır" isteğinin gerçek karşılığı.
- Giriş muayenesinde `productId` OPSİYONEL bırakıldı — `proc_po_lines`'ın
  kendi `productId` TAŞIMAMASI (yalnızca serbest metin `description`)
  yüzünden satınalma zincirinden güvenilir şekilde çözülemiyor, muayeneyi
  yapan kişi biliyorsa elle seçer (Faz 4'ün `idealCycleTimeSeconds`'ıyla
  AYNI "dürüst opsiyonellik" ilkesi).
- MySQL'in 64 karakterlik FK-adı sınırı yine migration üretilmeden önce
  proaktif doğrulandı (`grep`+`awk`, en uzunu 52 karakter) — bu fazda hiç
  kısaltma gerekmedi (tablo/kolon adları zaten kısa).

Test: `tests/quality.test.ts` (kalıcı) — gerçek bir Tedarikçi+PO+Mal Kabul
zinciri (Satınalma'nın ÜST katmanları bu testte doğrudan sabitlendi, test
edilen Satınalma değil Kalite) + gerçek bir üretim emri/operasyonu üzerinden
Giriş/Proses/Final muayenesi, Geçen+Ret≠Muayene Edilen reddi, NCR'nin tam
CAPA yaşam döngüsü (OPEN→INVESTIGATING→CORRECTIVE_ACTION→VERIFICATION→
CLOSED, her adımın sırasız atlanamayacağı doğrulandı) + doğrudan ret
senaryosu + kapatılmış/reddedilmiş bir NCR'nin tekrar işlenemediği, ve
Tedarikçi Kalite raporunun (kabul oranı %50, NCR önem dağılımı, açık NCR
sayısı) TAM doğru hesaplandığı — 21/21 gerçek DB'de geçti. Yedi kalıcı test
paketi (accounting/holding/sales/production/mrp/mes/quality) birlikte
toplam 121/121. `tsc --noEmit` + `npm run build` temiz. Bu oturumda da canlı
tarayıcı aracı erişilebilir DEĞİLDİ (Faz 4'teki AYNI durum) — yeni
`/dashboard/quality` sayfaları yalnızca derleme seviyesinde doğrulandı.

## FAZ 6 — EAM (Genel Bakım) + Enerji ✅

**Bağımlılık:** yok (mevcut IT-scope'lu `maintenancePlans` genişletilir, yeni
bir paralel tablo AÇILMAZ — Kural: "aynı veri iki modülde tutulmaz", master
prompt §149). Genel fabrika ekipmanı/bina bakımı + enerji (elektrik/doğalgaz/
su/buhar/basınçlı hava) tüketim takibi, ürün-başı enerji hesaplaması.

Teslim edilenler: `maintenancePlans`'a GERİYE UYUMLU iki opsiyonel kolon
(`eamAssetId`, `departmentId`) eklendi — plan/work-order/scheduler motoru
(`lib/it/maintenance.ts`, `lib/scheduler.ts`) TEK, hem IT hem EAM
planlarını AYNI `runDueMaintenanceGeneration` çağrısıyla işler.
`eam_asset_types`(seed, 11 tip)→`eam_assets`(kompresör/jeneratör/HVAC/bina
vb.) GERÇEKTEN yeni bir veri modeli — `it_assets` bilgisayar/ağ/yazılımı
kapsıyor, fabrika ekipmanını KAPSAMIYOR. Enerji: `energy_meters`(opsiyonel
`workCenterId`/`eamAssetId`)→`energy_readings`(dönem bazlı tüketim, bir
fatura gibi)→`getEnergyPerUnit` (lib/mes/oee.ts + lib/quality/
supplier-score.ts İLE AYNI ÜÇÜNCÜ "saklanan alan değil, talep üzerine
hesaplanan rapor" uygulaması).

Mimari notlar:
- **GERÇEK bir latent routing hatası bulunup düzeltildi**: `lib/scheduler.ts`
  bugüne kadar TÜM vadesi gelen planları KOŞULSUZ IT departmanının ticket
  kuyruğuna yazıyordu (`runDueMaintenanceGeneration`'a hep IT departmanı
  veriliyordu, fonksiyonun kendisi hiçbir planın KENDİ departmanını
  SORMUYORDU). EAM planları eklenmeden önce bu hiç sorun yaratmıyordu
  (tek tüketici IT'ydi) — EAM'in ilk GERÇEK ikinci tüketici olmasıyla
  ortaya çıkan bir tasarım eksikliğiydi. Düzeltme: her plan artık KENDİ
  `departmentId`'sini taşıyabilir (`plan.departmentId ?? fallbackDepartmentId`)
  — departmanı BOŞ olan (bugüne kadarki TÜM IT planları) fallback'e düşmeye
  devam eder, GERİYE UYUMLU; EAM planları kendi departmanına gider.
  `tests/eam.test.ts` bu iki davranışı TEK bir `runDueMaintenanceGeneration`
  çağrısıyla, aynı anda kanıtlıyor.
- `it_locations`'ın RACK/DESK/DATA_CENTER tipleri IT'ye özgü olduğundan bu
  hiyerarşiye ZORLANMADI — EAM varlıklarının konumu `branches` (zaten genel)
  + serbest metin `locationNote` ile yeterli.
- EAM varlık durumu için `it_asset_status_history`'nin tam karşılığı
  (ayrı bir geçmiş tablosu) BİLİNÇLİ OLARAK kurulmadı — bu fazın kapsamı
  (bakım + enerji) IT'nin CMDB/uyumluluk kaynaklı tam denetim izi ihtiyacını
  taşımıyor, dürüstçe kapsam dışı bırakıldı.
- Tedarikçi kaydı gibi burada da yeni bir "vendor/departman türü" İCAT
  EDİLMEDİ — EAM planının sorumlu departmanı, şirketin ZATEN var olan
  departman listesinden seçilir (ayrı bir "Bakım" department_type kodu
  ZORUNLU kılınmadı).

Test: `tests/eam.test.ts` (kalıcı) — bir eski-tarz IT planı (departmanı boş)
+ bir EAM planı (kendi departmanı dolu) TEK üretim çağrısıyla doğru
departmanlara yönlendiği, EAM ekipmanının bakım tamamlandığında OTOMATİK
IN_SERVICE'e döndüğü (gerçek ticket NEW→...→CLOSED zinciri üzerinden), ve
ürün-başı enerjinin (500 kWh / 100 adet = 5, dönem-dışı bir okuma hariç
tutularak) TAM doğru hesaplandığı — 17/17 gerçek DB'de geçti. Sekiz kalıcı
test paketi (accounting/holding/sales/production/mrp/mes/quality/eam)
birlikte toplam 138/138. `tsc --noEmit` + `npm run build` temiz. Bu
oturumda da canlı tarayıcı aracı erişilebilir DEĞİLDİ (Faz 4-5'teki AYNI
durum).

## FAZ 7 — Filo + Tesis Yönetimi ✅

**Bağımlılık:** yok. Araç/ruhsat/sigorta/bakım/yakıt/HGS + bina/kat/HVAC/
jeneratör/kamera/geçiş sistemi.

**"Tesis" yarısı AYRI bir modül OLARAK KURULMADI.** HVAC/jeneratör Faz
6'nın `eam_asset_types`'ında zaten vardı; kamera/geçiş sistemi burada iki
yeni satır olarak eklendi. "Bina/kat" ihtiyacı, Faz 4'ten beri şemada duran
ama Faz 7'ye kadar HİÇBİR gerçek tüketicisi olmayan `it_locations`'a
(`eam_assets.locationId`, yeni opsiyonel kolon) bağlanarak karşılandı —
`lib/it/locations.ts` (createLocation/listLocations) bu tablonun İLK
GERÇEK create/list fonksiyonları. "Geçiş sistemi" BİLİNÇLİ OLARAK yalnızca
bir donanım envanteri (EAM varlık tipi) — gerçek bir rozet/giriş-çıkış log
sistemi bu fazın KAPSAMI DIŞINDA, Core Security'nin (audit/RBAC) alanına
taşardı.

**"Filo" yarısı GERÇEKTEN yeni bir alan** — ne `it_assets` ne `eam_assets`
bir aracı modelleyebilir. Teslim edilenler: `vehicles`(plaka/ruhsat bitiş
tarihi/durum)→`vehicle_insurances`(poliçe)→`vehicle_expenses`(yakıt/HGS/
toll/yıkama/otopark TEK tabloda, expenseType ile ayrışır)→
`listExpiringVehicleDocuments`(ruhsat+poliçe için yaklaşan-sona-erme
raporu)→`getVehicleFuelEfficiency`(km/litre, iki kilometre okuması arası
farktan). Bakım, `maintenancePlans`/`maintenanceWorkOrders` motorunun
(Faz 6'nın `eamAssetId`'siyle AYNI desende) ÜÇÜNCÜ tüketicisi
(`vehicleId`) — motor artık IT + EAM + Filo'yu TEK yerden yönetiyor.

Mimari notlar:
- Bu oturumun BEŞİNCİ "saklanan alan değil, talep üzerine hesaplanan
  rapor" uygulaması (OEE→Tedarikçi Kalite→Enerji→şimdi Yakıt Verimliliği,
  ayrıca "Yaklaşan Sona Erme" raporu da aynı ailenin bir zaman-bazlı
  varyasyonu) — `kmPerLiter` aralıkta EN AZ İKİ kilometre okuması yoksa
  dürüstçe `null` döner, tek okumadan mesafe TÜRETİLEMEZ (Faz 4'ün
  `idealCycleTimeSeconds` tanımsızsa Performance=null İLE AYNI ilke).
- Yakıt/HGS/Toll/Yıkama/Otopark 5 AYRI tabloya AÇILMADI — NCR'nin 8D'yi 8
  sabit kolona zorlamamasıyla AYNI "isme değil şekle göre modelle" kararı,
  TEK `vehicle_expenses` tablosu + `expenseType` enum.

Test: `tests/fleet.test.ts` (kalıcı) — `it_locations`'ın gerçek
create/list'i + Bina→Kat hiyerarşisi + kamera'nın konuma doğru bağlandığı;
2 araç + 1 poliçe + yaklaşan-sona-erme raporunun (ruhsat+poliçe=2, uzak
tarihli 2. araç HARİÇ) doğruluğu; bir araç bakım planının KENDİ
departmanına (fallback'e DEĞİL) yönlendiği ve gerçek ticket NEW→...→CLOSED
zinciri üzerinden aracın otomatik ACTIVE'e döndüğü; yakıt verimliliğinin
(600 km / 90 litre = 6.667, dönem-dışı bir kayıt hariç tutularak) TAM
doğruluğu — 21/21 gerçek DB'de geçti. Dokuz kalıcı test paketi (accounting/
holding/sales/production/mrp/mes/quality/eam/fleet) birlikte toplam
159/159. `tsc --noEmit` + `npm run build` temiz. Bu oturumda da canlı
tarayıcı aracı erişilebilir DEĞİLDİ (Faz 4-6'daki AYNI durum).

## FAZ 8 — Proje Yönetimi ✅

**Bağımlılık:** Muhasebe (✅, bütçe/maliyet için). Proje/görev/milestone/
bütçe/hakediş — Satın Alma'nın proje-bazlı taleplerine bağlanabilir.

Teslim edilenler: `projects`(kod/ad/bütçe/yönetici/departman)→
`project_tasks`(üst-alt hiyerarşi, kendi tablosuna self-referans)→
`project_milestones`→`proj_progress_payments`(hakediş, DRAFT→APPROVED→
PAID, `lib/quality/ncr.ts` İLE AYNI isimlendirilmiş-fiil deseni)→
`getProjectBudgetStatus` (bu oturumun ALTINCI "saklanan alan değil,
talep üzerine hesaplanan rapor" uygulaması). `proc_requests`'e opsiyonel
`projectId` eklendi — Satın Alma'nın kendi akışı (onay/mal kabul/3-way-
match) HİÇ değişmedi, `budgetItemId`/`costCenterId` İLE AYNI opsiyonel-
entegrasyon deseni.

Mimari notlar:
- Bu fazın "bütçe"si, Muhasebe'nin KENDİ dönemsel/hesap-bazlı bütçe
  modelini (`budgets`/`budget_items`) TEKRARLAMADI — farklı bir soru
  soruyor ("bu projede ne kadar bütçe kaldı", dönemsel değil, proje
  ömrü boyunca tek bir toplam). `getProjectBudgetStatus`, projenin
  `budgetAmount`'ından Satın Alma'nın o projeye bağlı GERÇEK taleplerinin
  (`DRAFT`/`REJECTED`/`CANCELLED` HARİÇ) toplamını ve ÖDENMİŞ (yalnızca
  `PAID`) hakedişleri düşer — taslak bir talep ya da henüz onaylanmamış
  bir hakediş bütçeyi ETKİLEMEZ, dürüstçe hariç tutulur.
- `project_tasks.parentTaskId` kendi tablosuna self-referans —
  `mrp_planned_orders.parent_id`'de (Faz 3) karşılaşılan AYNI gerçek
  test-temizliği sorunu tekrar uygulandı (tek bir `DELETE` satırlar
  arası sırayı garanti etmez), bu kez self-referansı önce `NULL`'a
  çekerek çözüldü.
- Tablo adı `proj_progress_payments` olarak BİLİNÇLİ OLARAK kısaltıldı —
  MySQL'in 64 karakter FK-adı sınırı migration üretilmeden önce proaktif
  hesaplandı (en uzun constraint 60 karakter).

Test: `tests/projects.test.ts` (kalıcı) — üst-alt görev hiyerarşisi ve
sırasız tamamlama reddi; hakedişin DRAFT→APPROVED→PAID zincirinde her
adımın atlanamayacağı, geçersiz dönemin ve başka bir projenin
milestone'unun reddedildiği; bir satın alma talebinin projeye bağlandığı
ve `getProjectBudgetStatus`'ün (100000 − 20000 taahhüt − 10000 ödenen =
70000 kalan, DRAFT talep+hakediş dürüstçe hariç tutularak) TAM doğru
hesaplandığı — 15/15 gerçek DB'de geçti. On kalıcı test paketi
(accounting/holding/sales/production/mrp/mes/quality/eam/fleet/projects)
birlikte toplam 174/174. `tsc --noEmit` + `npm run build` temiz. Bu
oturumda da canlı tarayıcı aracı erişilebilir DEĞİLDİ (Faz 4-7'deki AYNI
durum).

## FAZ 9 — Hukuk + Risk Yönetimi ✅

**Bağımlılık:** Doküman Yönetimi (✅ `documentAttachments`). Sözleşme/dava/
teminat + risk kaydı (probability×impact×score×owner×mitigation).

Teslim edilenler: `legal_contracts`(tedarikçi/müşteri/kira/gizlilik/
hizmet)→`legal_lawsuits`(davacı/davalı, opsiyonel sözleşme bağlantısı)→
`legal_collaterals`(teminat mektubu/nakit/çek/senet)→
`risk_register_entries`(probability×impact→score, owner, mitigation).
Sözleşme/dava belgeleri, YENİ bir dosya-depolama kodu YAZILMADAN,
`document_attachments`'ın mevcut entityType/entityId desenine
(`'LEGAL_CONTRACT'`/`'LEGAL_LAWSUIT'`) bağlandı — İK'nın
`employee_contracts` dosya yükleme akışıyla BİREBİR aynı çağrı deseni.

Mimari notlar:
- `CONTRACT_TYPES`'a BİLİNÇLİ OLARAK "EMPLOYMENT" (iş sözleşmesi)
  EKLENMEDİ — İK Faz 1'in `employee_contracts`'ı ZATEN bu veriyi tutuyor
  (§150 Single Source of Truth). Bu modülün sözleşmeleri TİCARİ/HUKUKİ
  olanlar.
- Risk kaydının `score`'u, bu oturumun diğer "saklanan alan değil
  hesaplanan rapor" örneklerinin (OEE, tedarikçi kalite, enerji-başı-
  ürün, yakıt verimliliği, proje bütçesi) AKSİNE, GERÇEK bir kolon olarak
  saklandı — ama AYNI "kullanıcı elle giremez, lib katmanı her zaman
  yeniden hesaplar" disiplinini korudu. Fark: score = probability×impact
  basit bir çarpım, birden fazla kaynaktan dönemsel toplama İÇERMİYOR,
  tutarsızlık riski yok — DB'de sorgulanabilir/sıralanabilir kalması
  pratik bir avantaj.
- Teminat, Satın Alma'nın `proc_tenders.bidBondRequired`/
  `bidBondPercent`/`bidBondAmount`'ından (yalnızca bir ihalenin BEKLENEN
  teminatı) AYRI ve haklı bir varlık — bir sözleşmenin TÜM ömrü boyunca
  izlenen genel bir teminat kaydı.

Test: `tests/legal.test.ts` (kalıcı) — sona-erme raporunun yalnızca
ACTIVE+30-gün-içindeki sözleşmeyi yakaladığı (taslak ve uzak-tarihli
sözleşmeler hariç); sonuçlanmış bir davanın ve serbest bırakılmış bir
teminatın tekrar değiştirilemediği; risk skorunun HER değerlendirme
güncellemesinde YENİDEN hesaplandığı (4×5=20'den 2×3=6'ya, durum
MITIGATING'de sabit kalarak) ve kapatılmış bir riskin güncellenemediği;
`document_attachments`'ın hiçbir yeni kod olmadan gerçekten çalıştığı —
20/20 gerçek DB'de geçti. On bir kalıcı test paketi (accounting/holding/
sales/production/mrp/mes/quality/eam/fleet/projects/legal) birlikte
toplam 194/194. `tsc --noEmit` + `npm run build` temiz. Bu oturumda da
canlı tarayıcı aracı erişilebilir DEĞİLDİ (Faz 4-8'deki AYNI durum).

## FAZ 10 — Çevre/İSG (HR dışı) + Ar-Ge ✅

**Bağımlılık:** İK (✅, kısmi İSG zaten HR'da var — PDKS/eğitim). Emisyon/
atık/çevre izni + Ar-Ge proje/prototip/laboratuvar.

Teslim edilenler — üç ayrı alt-alan: **Çevre** (`env_permits`→
`env_emission_records`/`env_waste_records`→`getEnvironmentalSummary`, bu
oturumun kaçıncı olduğu artık sayılamayan "saklanan alan değil, dönem
bazlı hesaplanan rapor" uygulaması), **İSG HR-dışı** (`safety_incidents`
— OPEN→INVESTIGATING→CLOSED, `employees`'e opsiyonel referans), **Ar-Ge**
(`rnd_prototypes`→`rnd_lab_tests`, ikisi de opsiyonel bağlanır).

Mimari notlar:
- Madde metninin kendi notu ("kısmi İSG zaten HR'da var — PDKS/eğitim")
  doğrulandı ve UYGULANDI: `employeeQualifications`'ın TRAINING tipi
  zaten eğitim kayıtlarını, PDKS zaten devam takibini tutuyor — İKİSİNE
  de BURADA DOKUNULMADI. Bu fazın `safety_incidents`'ı, Faz 9'un
  `risk_register_entries`'inden (POTANSİYEL risk) BİLİNÇLİ OLARAK AYRI —
  GERÇEKLEŞMİŞ bir olayın kaydı, iki farklı kavram.
- **"Ar-Ge proje/prototip/laboratuvar"'ın PROJE yarısı AYRI bir tablo
  olarak KURULMADI** — Faz 8'in ZATEN var olan `projects` tablosu
  DOĞRUDAN kullanılır (§150), yalnızca prototip/laboratuvar gerçekten
  yeni kavramlar.
- **tsc'nin Faz 9'da yakaladığı `$inferInsert`/default-kolon dersinin
  BAŞTAN uygulanması**: `updatePrototypeStatus`/`updateLabTestStatus`'un
  `status` parametreleri BAŞTAN `$inferSelect`'ten tiplendi
  (`$inferInsert`'ten DEĞİL) — SELECT sonucunda default'lu bir kolon bile
  her zaman dolu geldiğinden `string | undefined` sorunu hiç oluşmadı,
  Faz 9'un commit mesajına yazılan dersin gerçek bir tekrarı.

Test: `tests/environment-safety-rnd.test.ts` (kalıcı) — üç alt-alanı TEK
dosyada test ediyor (Faz 6/9'un çoklu-alt-alanı tek dosyada test etme
deseniyle AYNI). Sona-erme raporunun doğruluğu; dönem özetinin (CO2=150,
NOX=20, HAZARDOUS=30, RECYCLABLE=10) aralık-dışı kayıtları dürüstçe hariç
tuttuğu; olmayan bir çalışan/proje/prototiple kayıt oluşturulamadığı;
olay/prototip/testin sırasız geçiş ve sonuçlanma-sonrası değişiklik
denemelerinin reddedildiği — 18/18 gerçek DB'de geçti. On iki kalıcı test
paketi (accounting/holding/sales/production/mrp/mes/quality/eam/fleet/
projects/legal/environment) birlikte toplam 212/212. `tsc --noEmit` +
`npm run build` temiz. Bu oturumda da canlı tarayıcı aracı erişilebilir
DEĞİLDİ (Faz 4-9'daki AYNI durum).

## FAZ 11 — Hazine Genişletme ✅

**Bağımlılık:** Muhasebe/Kasa-Banka (✅). Nakit akış tahmini, kur riski,
teminat yönetimi — mevcut basit kasa/banka/çek'in üzerine.

**Teminat yönetimi İÇİN YENİ bir tablo AÇILMADI** — Faz 9'un
`legal_collaterals`ı ZATEN genel (`contractId` OPSİYONEL) — Hazine
sayfası `contractId IS NULL` olan satırları gösterir, `lib/legal/
collaterals.ts`'in create/list/release fonksiyonları + `CreateCollateralForm`
/`ReleaseCollateralButton` bileşenleri DOĞRUDAN yeniden kullanıldı. Sıfır
yeni kod — bu oturumdaki EN AÇIK §150 uygulaması.

Nakit akış tahmini ve kur riski, YENİ bir muhasebe/kasa motoru KURMADI —
madde metninin kendi notu ("mevcut basit kasa/banka/çek'in ÜZERİNE")
harfiyen uygulandı: `getCashFlowForecast` mevcut banka bakiyesini
(`lib/accounting.ts:getTrialBalance`'ın KENDİSİNDEN, `bank_transactions`'ı
AYRICA toplamadan — iki kaynak, iki gerçek riski yok) + çekler + YENİ TEK
tablo (`treasury_cash_flow_items`, manuel/bilinen büyük tahsilat-ödeme
kalemleri) TALEP ÜZERİNE toplar. `getFxExposure`, yabancı para banka
hesaplarının `accounting_journal_lines`'ın ZATEN taşıdığı native
debit/credit + baseCurrencyDebit/baseCurrencyCredit'ten native bakiye +
defter değeri (işlem anındaki kur) hesaplar, `exchange_rates`'in ZATEN var
olan `getLatestExchangeRate`'iyle GÜNCEL değeri ve gerçekleşmemiş kâr/zararı
türetir.

Mimari notlar:
- **Gerçek bir bulgu, dürüstçe not edildi (kapsam DIŞI bırakıldı)**:
  `lib/bank.ts:recordBankTransaction` bugün yabancı para/kur parametresi
  ALMIYOR — her zaman `currency='TRY'` varsayılanıyla `postJournal`'a
  gider. Yani bugün UYGULAMADA bir USD banka hesabına
  `recordBankTransaction` ile işlem girilirse, muhasebe kaydı YANLIŞ
  şekilde TRY olarak defterleşir. Bu, Faz 11'in kapsamı DIŞINDA GERÇEK bir
  gelecek iyileştirme — `getFxExposure`'ın KENDİSİ doğru çalışıyor (test,
  `postJournal`'ı DOĞRUDAN, doğru para birimi/kurla çağırarak
  doğrulandı), yalnızca banka modülünün GİRİŞ tarafı henüz çoklu-para
  girişini desteklemiyor.
- `getFxExposure`'ın `currentTryValue`/`unrealizedGainLoss`'u, o para
  birimi için GÜNCEL bir kur BULUNAMAZSA dürüstçe `null` döner (Faz 4'ün
  `idealCycleTimeSeconds` tanımsızsa Performance=null İLE AYNI ilke) —
  `bookedTryValue` (defter değeri) yine de hesaplanır, yalnızca "bugünkü
  değer" ve "kâr/zarar" boş kalır.

Test: `tests/treasury.test.ts` (kalıcı) — mevcut nakidin GERÇEKTEN
muhasebenin defter-i kebirinden okunduğu; tahsil edilmiş/aralık-dışı
çeklerin ve iptal/gerçekleşmiş kalemlerin tahminden dürüstçe hariç
tutulduğu (10000 mevcut + 5000 tahsilat − 2000 ödeme = 13000 projeksiyon);
kur riskinin native (1000 USD)/defter (30000₺, işlem anı kuru)/güncel
(32000₺, bugünkü kur)/gerçekleşmemiş kâr (2000₺) değerlerinin TAM doğru
hesaplandığı — 13/13 gerçek DB'de geçti. On üç kalıcı test paketi
(accounting/holding/sales/production/mrp/mes/quality/eam/fleet/projects/
legal/environment/treasury) birlikte toplam 225/225. `tsc --noEmit` +
`npm run build` temiz. Bu oturumda da canlı tarayıcı aracı erişilebilir
DEĞİLDİ (Faz 4-10'daki AYNI durum).

## FAZ 12 — BI + Holding/CEO Dashboard ✅

**Bağımlılık:** Faz 0-11'in TÜMÜ (veri kaynakları olgunlaşmadan anlamlı BI
olmaz — master prompt'un kendi §148 ilkesi: "her modül veri ürettiğinde BI
katmanına uygun event/metric üretir"). CEO/Fabrika Müdürü/CFO/IT Müdürü
dashboard'ları, Alert Center, Expiration Engine (garanti/lisans/sözleşme/
sertifika — kısmen İK Faz 1'de `listExpiringQualifications` olarak zaten var,
genelleştirilecek).

**Yapıldı (2026-09-02):** Hiçbir yeni tablo/migration YOK — bu fazın TAMAMI
bu oturumun OEE'den beri tekrar tekrar uyguladığı "saklanan alan değil,
talep üzerine hesaplanan rapor" ilkesinin şirket-geneli bir uzantısı.

- **Expiration Engine** (`lib/bi/expiration.ts:getExpirationAlerts`) —
  madde 566'nın istediği genelleştirme TAM OLARAK yapıldı: Fleet
  (`listExpiringVehicleDocuments`), Legal (`listExpiringContracts`),
  Environment (`listExpiringEnvPermits`), HR (`listExpiringQualifications`)
  DOĞRUDAN yeniden kullanıldı (§150, sıfır yeni sorgu). IT'nin 3 fonksiyonu
  (`listExpiringLicenses/Warranties/Contracts`) SABİT bir
  `EXPIRING_SOON_DAYS=30` sabitine göre filtrelenmiş döndüğü için (parametre
  almıyor), `withinDays`'in TÜM kaynaklarda TUTARLI çalışması adına IT'nin
  FİLTRESİZ tam listeleri (`listLicenses/listWarranties/listContracts`)
  kullanılıp filtre BURADA (tek yerde) uygulandı — testte doğrulandı: IT
  lisansı/sözleşmesi 25/28 gün sonra sona eriyor, IT'nin kendi sabit 30-gün
  sabitiyle YANLIŞLIKLA örtüşmüyor, BI'ın kendi withinDays parametresiyle
  doğru yakalanıyor.
- **Alert Center** (`lib/bi/alerts.ts:getAlertCenterItems`) — açık İSG
  olayı/NCR/müşteri şikayeti/dava + skor≥15 risk kaydı + (Expiration
  Engine'i 7-gün penceresiyle çağırarak) yakın-sona-erecek kayıtları TEK
  listede toplar, severity (HIGH/MEDIUM) her modülün KENDİ severity/
  priority/skor alanından türetilir — YENİ bir "alert" tablosu veya kural
  motoru AÇILMADI (bilinçli kapsam kararı, dosya içi yorum: TODO
  CONFIGURABLE_ALERT_THRESHOLDS).
- **Rol-bazlı özetler** (`lib/bi/dashboard.ts`) — `getExecutiveSummary`
  (CEO), `getFactoryManagerSummary` (Fabrika Müdürü), `getCfoSummary` (CFO):
  üçü de it/dashboard.ts'in AYNI ucuz-toplama deseniyle (COUNT/GROUP BY) +
  ZATEN var olan `getFinancialStatements`/`getCashFlowForecast`/
  `getFxExposure` fonksiyonlarının doğrudan yeniden kullanımıyla inşa
  edildi — CFO'nun gelir/gider rakamı BİLİNÇLİ OLARAK sipariş/fatura
  satırlarından TOPLANMADI, muhasebenin defter-i kebirinden (tek doğru
  kaynak) geldi. BT Müdürü dashboard'u AYRICA inşa EDİLMEDİ — Faz 10'dan
  beri zaten var (`lib/it/dashboard.ts`,
  `/dashboard/departments/[id]/it/dashboard`), BI sayfası ona yalnızca
  LİNK verir (§150).
- **UI**: `/dashboard/bi` (yalnızca `requireFactoryAdmin` — şirket geneli
  veri = yalnızca fabrika yöneticisi, procurement/dashboard.ts İLE AYNI
  ilke), CEO/Fabrika Müdürü/CFO panelleri + Alert Center tablosu +
  Expiration Engine tablosu (URL'den `withinDays` parametreli, treasury
  sayfasının tarih-aralığı form deseniyle AYNI).
- **Kalıcı test** (`tests/bi.test.ts`, `npm run test:bi`, 23/23) —
  Expiration Engine'in 5 modülü DOĞRU birleştirdiği + withinDays sınırının
  IT dahil TÜM kaynaklarda tutarlı çalıştığı + Alert Center'ın severity
  eşiklerinin (MAJOR/SEVERE→HIGH, MINOR NCR listeden ÇIKARILMAZ ama
  MEDIUM'a düşer) doğru olduğu TAM test edildi; üç özet fonksiyonu ise
  (it/dashboard.ts'in getItDashboardSummary'sinin KENDİSİ hiç ayrı test
  edilmediği emsaliyle TUTARLI olarak) atmadan çalıştığı + Alert
  Center/Expiration Engine ile TUTARLI sayı döndürdüğü doğrulanarak hafif
  kapsamda test edildi. Tam regresyon (13 paket, tümü yeşil) + `tsc
  --noEmit` + `npm run build` (tümü hatasız).

## FAZ 13 — Integration Hub + Event Bus

**Bağımlılık:** yok ama en çok fayda Faz 0-12 sonrasında (event üretecek
modül sayısı arttıkça değer artar). Bank/E-Belge/RFID/PLC/SCADA/LDAP/Email/
SMS provider abstraction + merkezi event bus (bugün kod içi yorumlarla
"yok" diye işaretli).

## FAZ 14 — Feature Flags + Central Configuration

**Bağımlılık:** yok, ama önceki fazların ürettiği modülleri aç/kapa
edebilmek için mantıklı sırası burası.

## FAZ 15 — Mobil (itandroid) Genişletme

**Bağımlılık:** ilgili her fazın kendi API'si. Bugün itandroid'in Onay Kutusu
zaten LEAVE/OVERTIME/BONUS/DATA_SUBJECT_REQUEST'i otomatik destekliyor (jenerik
workflow dispatch sayesinde) — yeni fazlar kendi documentType'larını EKLEDİKÇE
mobilde otomatik görünür, ayrı bir "mobil fazı" çoğu modül için gerekmez. Bu
faz yalnızca saha-özel ekranları (Filo/EAM saha servisi, Üretim/MES operatör
ekranı) kapsar.

## FAZ 16 — AI Hazırlığı

**Bağımlılık:** Faz 0-15'in ürettiği yapılandırılmış veri/event/audit. Master
prompt §103-105 zaten "AI şimdi eklenmeyecek, altyapı hazır tutulacak" diyor —
bu faz kod değil, veri sınıflandırması/izin kontrolünün AI-erişimine hazır
olduğunun doğrulanmasıdır (Core Security'nin `classification.ts`/
`view_sensitive` deseni zaten bu amaçla kuruldu).

## FAZ 17 — Enterprise Hardening

**Bağımlılık:** hepsi. Master prompt §79-85'in tam test/CI/CD/observability/
backup/DR listesi — her önceki fazın KENDİ test paketi zaten vardı, bu faz
onları birleştirip regresyon/performans/DR tatbikatına çevirir.

## Notlar

- Sıralama kesin değil — bir fazın ortasında gerçek bir bağımlılık çakışması
  bulunursa (ör. Faz 6 EAM, Faz 7 Filo'dan önce mi sonra mı daha mantıklı)
  ASSUMPTIONS.md'ye gerekçesiyle kaydedilip sıra güncellenir.
- Her faz kendi commit'i, kendi test scripti (kullanılıp silinen), kendi
  mimari belgesiyle (mevcut `IT-ARCHITECTURE.md`/`ACCOUNTING-ENGINE.md`
  tarzında) teslim edilir — bu roadmap güncellenerek ✅ işaretlenir.
- Bu, gerçek bir kurumsal ERP'nin tam kapsamıdır (master prompt'un kendi
  §156'sı: "kısa vadeli kolaylık uğruna uzun vadeli mimariyi bozma") — haftalar/
  aylar süren, fazlara bölünmüş bir iştir; ASSUMPTIONS.md §2'de bu tempo
  açıkça not edildi.
