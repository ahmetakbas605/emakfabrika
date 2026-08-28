# ACCOUNTING-ENGINE.md

İlk departman: **Muhasebe**. Bu belge PDF'teki 100 maddenin muhasebeye doğrudan
değen kısmının (madde 1-44, 52, 60, 77, 86, 94-97) somut tasarımıdır.

## 1. En kritik mimari kural: ERP ≠ Muhasebe (PDF madde 94)

Muhasebe motoru, diğer modüllerden (Satış, Stok, Kasa) **event dinleyerek**
çalışır, doğrudan çağrılarak değil:

```
Satış Faturası kaydedilir
  → InvoiceCreated eventi yayınlanır
  → Accounting Engine bu eventi dinler
  → İlgili accounting_posting_rules satırı bulunur
     (document_type='SALES_INVOICE', transaction_type=...)
  → debit_account_rule / credit_account_rule / tax_account_rule
     çözümlenir (hangi hesap kodu kullanılacak)
  → accounting_journals + accounting_journal_lines yazılır (TEK transaction)
  → AccountingEntryCreated eventi yayınlanır
```

Bu, emakerp'te `syncContractCariDebt` gibi fonksiyonların yaptığının bir üst
seviye genellemesi — emakerp'te doğrudan çağrı (`await syncContractCariDebt(...)`)
var, burada event-tabanlı olacak çünkü PDF'in kendi isteği (madde 45) ve
gerçek fayda: yarın "Stok" departmanı geldiğinde `StockReceived` eventini HEM
muhasebe HEM başka bir modül dinleyebilir, muhasebe koduna dokunmadan.

**Faz 4 kapsamı, henüz kod yok** — bu, event bus'ın kendisi mi (basit bir
in-process EventEmitter, emakerp'in tek-process PM2 modeliyle uyumlu — Next.js
zaten tek Node süreci) yoksa gerçek bir mesaj kuyruğu mu (Redis/RabbitMQ)
olacağı `TODO: EVENT_BUS_CHOICE` — başlangıç ölçeğinde (tek fabrika, tek süreç)
in-process EventEmitter yeterli, dış kuyruk gereksiz karmaşıklık; PDF madde 67
("gereksiz abstraction oluşturma") ile de uyumlu.

## 2. Hesap planı (PDF madde 15)

`accounting_accounts` — kullanıcı tanımlı, Tek Düzen Hesap Planı **seed** olarak
verilir ama kod içine gömülmez:

```
id, company_id, code (ör. "120", "600.01"), name,
parent_account_id (self-FK, alt hesap hiyerarşisi),
normal_balance ('DEBIT' | 'CREDIT'),
account_type ('ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE'),
is_active
```

Seed: Tek Düzen Hesap Planı'nın standart 1-9 ana grup + PDF'in örnek verdiği
(100 Kasa, 120 Alıcılar, 320 Satıcılar, 600 Yurtiçi Satışlar, 391 Hesaplanan
KDV, 191 İndirilecek KDV vb.) satırları — company oluşturulurken otomatik
kopyalanır, sonrasında kullanıcı düzenleyebilir/genişletebilir.

## 3. Otomatik muhasebe fişi (PDF madde 16)

`accounting_posting_rules`:
```
id, document_type ('SALES_INVOICE'|'PURCHASE_INVOICE'|'PAYMENT'|...),
transaction_type, debit_account_rule, credit_account_rule,
tax_account_rule, cost_account_rule
```

`*_account_rule` alanının ne taşıyacağı somutlaştırılmalı — sabit bir hesap
kodu mu (`"120"`), yoksa hesap TÜRÜne göre dinamik çözümleme mi (ör. "bu
carinin kendi 120.xxx alt hesabı")? Gerçek muhasebe pratiğinde cari bazında
YARDIMCI hesap (alt hesap) açılır — karar: `debit_account_rule` bir hesap KODU
DEĞİL, bir **çözümleyici anahtarı** (`"CARI_SUBACCOUNT:120"` gibi) taşır, gerçek
kod çalışma zamanında o carinin kendi alt hesabına (yoksa otomatik açılır)
çözümlenir — emakerp'in `findOrCreateCariAccount` desenine benzer, muhasebe
hesabı seviyesinde.

## 4. Çift-kayıt doğrulama motoru (PDF madde 86)

```
TOTAL_DEBIT(journal) == TOTAL_CREDIT(journal)
```

MySQL'de çok-satırlı bir toplam eşitliğini DB constraint ile garanti etmek
pratik değil (§ ARCHITECTURE.md riski) — bu yüzden: `accounting_journals`
INSERT'i her zaman `accounting_journal_lines` ile AYNI uygulama-katmanı
transaction'ı içinde olur, satırlar yazıldıktan HEMEN SONRA (commit'ten ÖNCE)
toplam kontrol edilir, eşit değilse `AccountingError` fırlatılır ve transaction
rollback olur — "dengesiz fiş DB'ye kaydedilmemelidir" kuralı (madde 86) böyle
sağlanıyor: veri asla dengesiz hâlde kalıcı olmuyor, ama bunu bir DB kısıtı
değil bir uygulama-katmanı garantisi olarak yapıyoruz (dürüstçe dokümante edilen
bir risk kabulü — bkz. SECURITY-ARCHITECTURE.md).

## 5. Dönem kilitleme + Financial Immutability (PDF madde 17, 77)

`accounting_periods` (company_id, period_start, period_end, status: `OPEN` |
`CLOSED`). Kapalı dönemde `accounting_journals`/`accounting_journal_lines`
UPDATE/DELETE **uygulama katmanında engellenir** (yazma fonksiyonu önce dönemi
kontrol eder). Düzeltme gerekirse:

- `REVERSAL` — orijinal fişin ters işaretli bir kopyası (aynı hesaplar, ters
  borç/alacak), orijinali işaret eder (`reversal_of_journal_id`).
- `CORRECTION` — reversal + yeni doğru fiş, ikisi birlikte "düzeltme grubu"
  oluşturur (`correction_group_id`).

Hiçbir muhasebe fişi fiziksel `DELETE` ile silinmez — PDF madde 54'ün
(soft-delete yerine `status`/`cancelled_at`/`reversal_id`) muhasebe fişlerine
uygulanmış hâli.

## 6. KDV motoru (PDF madde 12-13)

Fatura satırı seviyesinde: `vat_rate` (MEVZUAT-MAP.md'deki `tax_rules`'tan
çözümlenir, satıra göre farklı olabilir — aynı faturada %20 ve %1 kalem bir
arada olabilir), `vat_amount`, `withholding_code` (varsa), `withholding_rate`,
`withholding_amount`. Tevkifatlı satırlarda gerçek ödenecek KDV = hesaplanan
KDV − tevkif edilen KDV; muhasebeleştirmede SATICI ve ALICI KDV hesapları AYRI
satırlara yazılır (PDF madde 13'ün "satıcı KDV / alıcı KDV" ayrımı).

## 7. Döviz ve kur farkı (PDF madde 30, 97. senaryo)

Her finansal kayıt: `transaction_currency`, `exchange_rate`,
`base_currency_amount` (her zaman TRY), `transaction_currency_amount`. Fatura
USD, cari USD takip edilebilir, ama **muhasebe hesap planı her zaman TRY**
(Türkiye mevzuatı gereği — yasal defterler TL bazlı tutulur, bu konuda
`TODO: LEGAL_REVIEW_REQUIRED` gerekmiyor, VUK'un temel ilkesi budur, ama kesin
metin SMMM ile teyit edilmeli). Tahsilat farklı kurdan yapılırsa: kur farkı
otomatik hesaplanır ayrı bir muhasebe fişi satırı olarak ("646 Kambiyo Kârları"
/ "656 Kambiyo Zararları" tipi hesaplar — seed hesap planında yer alacak).

## 8. E-belge motoru

Bkz. MEVZUAT-MAP.md §3 — `ElectronicDocumentProvider` arayüzü ve
`SmartDonusumProvider` (emakerp'in kanıtlanmış `kolay-core.ts` portu).

## 9. Gerçek hayat senaryoları (PDF madde 95-97) — tasarım doğrulaması

Kod henüz yazılmadığı için bunlar ÇALIŞTIRILAMADI — ama tasarımın bu üç
senaryoyu karşılayıp karşılamadığı burada MASA BAŞINDA doğrulandı, Faz 4-6
kodlandığında gerçek, otomatik test senaryoları olarak birebir uygulanacak:

- **Senaryo 1 (vadeli satış + kısmi tahsilat):** InvoiceCreated → cari alacak
  (120 borç) + KDV (391 alacak) + gelir (600 alacak) + stok çıkışı/maliyeti
  (620 borç / 153 alacak) tek journal'da, TOTAL_DEBIT=TOTAL_CREDIT doğrulanır.
  Kısmi ödeme → PaymentCreated → cari 120 alacak azalır, kasa/banka borç artar,
  cari bakiye = önceki bakiye − ödeme (mizanda doğrulanabilir).
- **Senaryo 2 (tevkifatlı alış):** PurchaseInvoiceCreated → stok girişi (153
  borç) + indirilecek KDV (191 borç, tevkif edilen kısım DÜŞÜLMÜŞ) + satıcı cari
  (320 alacak, net tutar) + tevkifat hesabı (360 alacak, tevkif edilen KDV —
  bu tutar sorumlu sıfatıyla BEYAN EDİLECEK, ayrı bir "sorumlu sıfatıyla
  ödenecek KDV" hesabı).
- **Senaryo 3 (dövizli satış + kur farkı):** fatura USD, cari USD bakiye tutar,
  muhasebe TRY'ye kur ile çevrilir; tahsilat farklı kurdan yapılınca fark
  otomatik 646/656 hesabına düşer, cari USD bakiyesi sıfırlanır (TRY defter
  bakiyesi kur farkı kadar fazla/eksik kalır — bu FARK muhasebeleştirilmezse
  mizan tutmaz, motorun bunu OTOMATİK üretmesi zorunlu).

Dördüncü senaryo (çoklu-fabrika izolasyonu, PDF madde 98) burada anlamsız —
her fabrika zaten fiziksel olarak ayrı DB'de, "Tenant A'nın Tenant B verisini
görememesi" testi emakerp'in RLS testiyle aynı ANLAMI taşımıyor (mimari olarak
imkansız, test etmeye gerek yok) — bunun yerine TEK fabrika içinde
Company A'nın Company B'nin muhasebe verisini görememesi test edilecek
(uygulama-katmanı filtre — bkz. SECURITY-ARCHITECTURE.md §4).
