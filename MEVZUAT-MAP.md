# MEVZUAT-MAP.md

**Önemli uyarı (PDF madde 92'nin gereği):** Bu belge bir hukuki/mali görüş
DEĞİLDİR. Ben bir SMMM/mali müşavir değilim. Aşağıdaki oranlar/kurallar genel
bilgi amaçlıdır ve gerçek kullanım öncesi bir mali müşavir tarafından
doğrulanmalıdır. Emin olunmayan her nokta `TODO: LEGAL_REVIEW_REQUIRED` ile
işaretlenmiştir — bunlar tahmin edilerek koda GÖMÜLMEYECEK.

## 1. Rule engine mimarisi (PDF madde 4)

`tax_rules`, `withholding_rules`, `document_rules`, `declaration_rules`,
`invoice_rules`, `payroll_rules`, `e_document_rules` — hepsi AYNI temel şablonu
paylaşır (PDF'in kendi alan listesi):

```
rule_code, rule_name, description,
effective_from, effective_to,          -- PDF madde 76: mevzuat değişse bile
                                        -- eski kayıtlar eski kurala göre kalır
country, company_type, taxpayer_type, sector,   -- kapsam filtresi
condition, calculation_method, rate, threshold, -- hesaplama
status, source_reference, version               -- izlenebilirlik
```

Uygulama katmanında **tek bir sorgu fonksiyonu** bunu okur:
`resolveRule(ruleCode, { asOfDate, companyType, sector, ... })` →
`effective_from <= asOfDate < COALESCE(effective_to, MAX_DATE)` filtresiyle o
anki geçerli kuralı döndürür. Hiçbir yerde `KDV = 0.20` gibi sabit kod
YAZILMAYACAK — her hesaplama bu fonksiyondan geçer.

**Emin olunmayan nokta:** `condition` alanının veri tipi/formatı — serbest metin
mi (elle yorumlanan), yoksa yapılandırılmış bir mini-DSL mi (ör. JSON tabanlı
basit karşılaştırma ağacı)? PDF bunu belirtmiyor. Karar Faz 4'te (Accounting
Core) verilecek — `TODO: RULE_CONDITION_FORMAT`.

## 2. Bilinen (2026 itibarıyla genel bilgi, DOĞRULANMALI) parametreler

Bunlar `tax_rules` gibi tabloların **seed** verisi olacak, kod sabiti DEĞİL:

| Parametre | Genel bilinen değer (2026) | Doğrulama durumu |
|---|---|---|
| Genel KDV oranı | %20 | `TODO: LEGAL_REVIEW_REQUIRED` — SMMM teyidi gerekli, ayrıca indirimli oranlı (%1, %10) kalemler ürün/hizmet bazında ayrıca tanımlanmalı |
| e-Fatura mükellefiyet limiti | Yıllık ciro eşiği (GİB'in güncel tebliğine göre değişken) | `TODO: LEGAL_REVIEW_REQUIRED` |
| e-Arşiv zorunluluğu | e-Fatura mükellefi olmayan, belirli ciro üstü satıcılar | `TODO: LEGAL_REVIEW_REQUIRED` |
| KDV tevkifat oranları | Mal/hizmet türüne göre değişken kesir (ör. 5/10, 7/10, 9/10) | `TODO: LEGAL_REVIEW_REQUIRED` — KDV Genel Uygulama Tebliği'nin ilgili ekine göre onlarca farklı oran var, tek bir sabit YOK |
| Damga vergisi oranı | Sözleşme/belge türüne göre binde X | `TODO: LEGAL_REVIEW_REQUIRED` |

Bu tablo **kasıtlı olarak eksik/yüzeysel bırakılmıştır** — amacı seed şemasının
şeklini göstermek, kesin oran listesi vermek değil. Gerçek oranlar Faz 4'te,
kullanıcının onayladığı bir kaynaktan (GİB tebliğ metni veya SMMM teyidi) girilecek.

## 3. e-Belge adapter mimarisi (PDF madde 19, 93)

```
interface ElectronicDocumentProvider {
  prepareInvoice(invoice): PreparedDocument;   // XML üret + validasyon
  send(document): SendResult;                  // gerçek gönderim
  queryStatus(documentId): StatusResult;
  cancel(documentId): CancelResult;
}
```

emakerp'in `lib/kolay-core.ts`/`lib/ubl-invoice.ts`'i (SmartDönüşüm SOAP + UBL-TR
2.1) **kanıtlanmış, çalışan bir referans implementasyon** — emakfabrika'nın ilk
`SmartDonusumProvider implements ElectronicDocumentProvider`'ı bunun MySQL'e
uyarlanmış hâli olacak (kimlik bilgisi okuma katmanı MySQL'den, SOAP/XML mantığı
aynı). Entegratör değişirse (başka bir özel entegratör) yalnızca yeni bir
`XProvider` sınıfı yazılır, ACCOUNTING-ENGINE.md'deki fatura akışı hiç değişmez.

## 4. Beyanname motoru (PDF madde 24)

Ayrı bir servis olarak, muhasebe kayıtlarından (yevmiye + hesap planı)
**türetilecek** — beyanname türleri (`KDV`, `Muhtasar ve Prim Hizmet`, `Damga`,
`Geçici Vergi`, `Kurumlar Vergisi`, `Gelir Vergisi`) parametrik bir
`declaration_types` tablosunda tanımlı, her biri "hangi hesap gruplarından hangi
toplamı çeker" kuralını `declaration_rules`'tan okur. **Faz 9'da (E-Belgeler)**
ele alınacak — şu an yalnızca mimari niyet, kod yok.

## 5. Bu belgenin genişleme kuralı

Her yeni departman PDF'i geldiğinde (İK/bordro, Üretim vb.) o departmana özgü
mevzuat (SGK oranları, İş Kanunu kesintileri, gümrük/ithalat kuralları vb.) bu
dosyaya YENİ bir bölüm olarak eklenecek — ayrı dosyalara bölünmeyecek, tek
"mevzuat haritası" burada tutulacak (PDF'in kendi dosya adı isteğiyle — tekil
MEVZUAT-MAP.md).
