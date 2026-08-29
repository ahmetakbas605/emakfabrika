# IT-MEVZUAT.md

**Uyarı (MEVZUAT-MAP.md'deki AYNI uyarı):** Ben hukuk/mevzuat uzmanı
değilim. Bu belge genel bilgi amaçlıdır, gerçek kullanım öncesi hukuk
danışmanlığıyla doğrulanmalıdır. Emin olunmayan her nokta
`TODO: LEGAL_REVIEW_REQUIRED` ile işaretlenmiştir.

## 1. KVKK (madde 133)

IT modülü, Muhasebe'den DAHA GENİŞ bir kişisel veri yüzeyine sahip:
çalışan-cihaz ilişkisi, konum verisi, saha fotoğrafları, network trafiği
(dolaylı olarak kullanıcı davranışı). Genel ilkeler IT-SECURITY.md §5'te —
burada mevzuat referansı: 6698 sayılı KVKK'nın "veri minimizasyonu, açık
rıza/meşru menfaat, saklama süresi sınırlaması" ilkeleri sistem
tasarımına şu şekilde yansıtıldı: konum takibi varsayılan KAPALI
(FIELD-SERVICE.md §2), fotoğraflar yalnızca ilişkili ticket/work_order
bağlamında saklanıyor (amaç sınırlaması). `TODO: LEGAL_REVIEW_REQUIRED` —
çalışan cihaz/konum takibinin İŞ SÖZLEŞMESİ/KVKK aydınlatma metni
açısından hangi hukuki dayanağa oturduğu (meşru menfaat mi, açık rıza mı)
şirketin kendi hukuk danışmanınca belirlenmeli, sistem her ikisini de
DESTEKLEYECEK esneklikte (açık/kapalı bayrak) tasarlandı.

## 2. Elektronik kayıtların saklanması

Audit log (`audit_logs`, `it_asset_status_history`, `ticket_status_history`)
— bu kayıtların ne kadar süreyle saklanması gerektiği net bir "IT
mevzuatı" maddesine bağlı DEĞİL genel olarak, ama bir SÖZLEŞME/GARANTİ/
LİSANS ile ilişkili kayıtlar (madde 128) o belgenin YASAL geçerlilik
süresiyle bağlantılı olabilir — `TODO: LEGAL_REVIEW_REQUIRED`, sözleşme
kayıtlarının saklama süresi Muhasebe'deki VUK 5 yıl kuralına PARALEL mi
yoksa bağımsız bir süre mi, netleşmedi.

## 3. Elektronik imza (madde 89)

"Müşteri/kullanıcı elektronik onayı" (servis raporu imzası) — bu, 5070
sayılı Elektronik İmza Kanunu anlamında NİTELİKLİ elektronik imza
DEĞİLDİR (parmak/stylus ile ekrana atılan bir "ıslak imza taklidi" —
hukuki bağlayıcılığı NİTELİKLİ imzadan farklı). Sistem bunu AÇIKÇA "onay
kaydı" (timestamp + IP + kullanıcı + imza görüntüsü) olarak saklayacak,
KESİN bir hukuki eşdeğerlik İDDİA ETMEYECEK — arayüzde de "elektronik onay"
denecek, "e-imza" değil (madde 92'nin "hukuki görüş gibi sunma" ilkesiyle
tutarlı, TERMİNOLOJİ seviyesinde bile dikkatli).

## 4. Siber güvenlik / bilgi güvenliği mevzuatı

Türkiye'de kritik altyapı işletmeleri için BTK/Siber Güvenlik Kurulu
düzenlemeleri olabilir — emakfabrika'nın hedef müşterisi (büyük
fabrikalar) bu kapsama girebilir ya da girmeyebilir, işletmenin
SEKTÖRÜNE bağlı. `TODO: LEGAL_REVIEW_REQUIRED` — bu proje kapsamında
hangi müşterinin (sektörüne göre) hangi ek düzenlemeye tabi olduğu
BELİRLENMEDİ, sistem bunu tenant-bazlı bir `compliance_framework` alanı
(gelecekte, gerekirse) ile parametrik tutmaya HAZIR ama bugün
kodlanmıyor.

## 5. Çalışan/personel verileri

FIELD-SERVICE.md §2'deki konum verisi + saha fotoğrafları, İş Kanunu'nun
"işçinin özel hayatına müdahale" sınırları açısından da değerlendirilmeli
— `TODO: LEGAL_REVIEW_REQUIRED`. Genel ilke uygulandı: yalnızca İŞ SAATİ
İÇİNDE, AKTİF bir iş emri bağlamında, AÇIK POLİTİKA ile veri toplanıyor.

## 6. Bu belgenin genişleme kuralı

MEVZUAT-MAP.md ile AYNI kural — yeni bir departman geldiğinde (ör. İK)
kendi mevzuat özellikleri varsa, o departmanın kendi ...-MEVZUAT.md'sine
yazılır; bu dosya yalnızca IT'ye özgü kalır.
