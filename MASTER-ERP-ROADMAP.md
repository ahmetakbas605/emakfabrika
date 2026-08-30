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

## FAZ 2 — Üretim Çekirdeği (BOM + Routing + Production Order)

**Bağımlılık:** Faz 1 (talep), Depo (✅), Satın Alma (✅ — malzeme tedariki).
BOM (revizyon/geçerlilik tarihli), Routing, İş Merkezi, Üretim Emri→İş Emri→
Malzeme Çıkışı→Üretim→Mamul.

## FAZ 3 — MRP

**Bağımlılık:** Faz 1+2. Satış siparişi+tahmin+min.stok+mevcut stok+açık
SO/PO üzerinden ihtiyaç patlatma.

## FAZ 4 — MES

**Bağımlılık:** Faz 2. Üretim emri/makine/operatör/duruş/arıza/OEE — PLC/
SCADA/IoT entegrasyonuna hazır event/API iskeleti (gerçek donanım entegrasyonu
KAPSAM DIŞI, master prompt §21 zaten "hazırlığa hazır ol" diyor, "entegre et"
demiyor).

## FAZ 5 — Kalite

**Bağımlılık:** Faz 2. Giriş/proses/final kalite, NCR/CAPA/8D, tedarikçi
kalite (Satın Alma'nın tedarikçi kaydına bağlanır).

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
