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

## FAZ 6 — EAM (Genel Bakım) + Enerji

**Bağımlılık:** yok (mevcut IT-scope'lu `maintenancePlans` genişletilir, yeni
bir paralel tablo AÇILMAZ — Kural: "aynı veri iki modülde tutulmaz", master
prompt §149). Genel fabrika ekipmanı/bina bakımı + enerji (elektrik/doğalgaz/
su/buhar/basınçlı hava) tüketim takibi, ürün-başı enerji hesaplaması.

## FAZ 7 — Filo + Tesis Yönetimi

**Bağımlılık:** yok. Araç/ruhsat/sigorta/bakım/yakıt/HGS + bina/kat/HVAC/
jeneratör/kamera/geçiş sistemi.

## FAZ 8 — Proje Yönetimi

**Bağımlılık:** Muhasebe (✅, bütçe/maliyet için). Proje/görev/milestone/
bütçe/hakediş — Satın Alma'nın proje-bazlı taleplerine bağlanabilir.

## FAZ 9 — Hukuk + Risk Yönetimi

**Bağımlılık:** Doküman Yönetimi (✅ `documentAttachments`). Sözleşme/dava/
teminat + risk kaydı (probability×impact×score×owner×mitigation).

## FAZ 10 — Çevre/İSG (HR dışı) + Ar-Ge

**Bağımlılık:** İK (✅, kısmi İSG zaten HR'da var — PDKS/eğitim). Emisyon/
atık/çevre izni + Ar-Ge proje/prototip/laboratuvar.

## FAZ 11 — Hazine Genişletme

**Bağımlılık:** Muhasebe/Kasa-Banka (✅). Nakit akış tahmini, kur riski,
teminat yönetimi — mevcut basit kasa/banka/çek'in üzerine.

## FAZ 12 — BI + Holding/CEO Dashboard

**Bağımlılık:** Faz 0-11'in TÜMÜ (veri kaynakları olgunlaşmadan anlamlı BI
olmaz — master prompt'un kendi §148 ilkesi: "her modül veri ürettiğinde BI
katmanına uygun event/metric üretir"). CEO/Fabrika Müdürü/CFO/IT Müdürü
dashboard'ları, Alert Center, Expiration Engine (garanti/lisans/sözleşme/
sertifika — kısmen İK Faz 1'de `listExpiringQualifications` olarak zaten var,
genelleştirilecek).

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
