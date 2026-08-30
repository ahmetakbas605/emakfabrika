# ASSUMPTIONS.md

Bu belge, "EMAKFABRİKA ERP — HOLDİNG + FABRİKA + SAHA + MOBİL" master prompt'unun
(156 madde) §1 kuralı gereği ("belirsiz bir konuda varsayım yapmak zorundaysan en
kurumsal ve ölçeklenebilir çözümü seç ve bunu dokümantasyona kaydet") alınan
kararları kayıt altına alır. Kullanıcıya "gerçek multi-tenant SaaS'a geçiş" mi
"mevcut model + Holding katmanı" mı sorulduğunda kullanıcı **"gerçek multi-tenant
SaaS'a geçiş"** seçeneğini işaretledi — ama bu seçimin TEKNİK anlamı, aşağıdaki
1. maddede açıklanan nedenle, satır-seviyesi `tenant_id`/RLS DEĞİL, mevcut
database-per-tenant modelin GERÇEKTEN inşa edilmesi/sertleştirilmesi olarak
yorumlandı.

## 1. KRİTİK KARAR: Tenant izolasyon modeli DEĞİŞMİYOR — güçlendiriliyor

**Bulgu:** Bu proje zaten, kendi Faz 1'inde (bkz. [TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md),
[ARCHITECTURE.md §1](./ARCHITECTURE.md#1-bu-proje-nedir-emakerpten-farkı-ne),
[DATABASE-ARCHITECTURE.md §4](./DATABASE-ARCHITECTURE.md#4-rls-yerine-ne-kullanılıyor),
[README.md](./README.md)), kullanıcının **kendi açık kararıyla**, tam bir
multi-tenant mimari tasarladı — yalnızca emakerp'in modelinden (paylaşımlı
Postgres + RLS + `tenant_id` sütunu) BİLİNÇLİ OLARAK farklı bir desenle:
**database-per-tenant** (her fabrika/holding = kendi fiziksel MySQL veritabanı +
kendi emakfabrika dağıtımı). Bu, RLS kadar yaygın, üretimde kanıtlanmış,
"gerçek" bir multi-tenancy desenidir (bazı büyük kurumsal SaaS'lar, özellikle
regülasyona/kurumsal-IT-politikasına tabi müşteriler için, tam olarak bunu
tercih eder — "verim kendi sunucunuzda kalsın" isteği tipik bir kurumsal
gereksinimdir).

Yeni master prompt'un §6'sı ("Multi-Tenant SaaS... Tenant: Holding/Company/
Factory/Branch... bir tenant başka tenant'ın verisini hiçbir koşulda
göremeyecek") kelimesi kelimesine okunursa emakerp tarzı paylaşımlı-şema+RLS
gibi görünüyor. Ama bu proje için o modele geçmek şu anlama gelir:

- 177 tablonun **147'sine** (`companyId` taşıyan tüm tablolar) yeni bir üst
  `tenantId`/`holdingId` sütunu eklemek,
- `companyId`'nin manuel olarak thread edildiği **124 dosyadaki 410 çağrı
  noktasının TAMAMINI** yeniden yazmak,
- Şu ana kadar bu oturumlarda TAMAMLANMIŞ, canlı test edilmiş, commit edilmiş
  her şeyi (HR Faz 0-5, Procurement Faz 0-8C, IT/ITSM'in 197 export'u, Core
  Security Platform'un tamamı — audit hash zinciri, MFA, session modeli, SoD,
  tamper protection, KVKK DSR akışı) **baştan sona dokunmayı gerektirir**,
- VE bu projenin kendi Faz 1'inde, kullanıcının kendi ağzından ("her açılan
  fabrika kendine ait sql görecek... kendi bünyesinde sunucuda tutar")
  gerekçelendirilmiş, dokümante edilmiş bir kararı **sessizce tersine
  çevirmek** anlamına gelir (Kural 2: "mevcut sistemi bozma" ile doğrudan
  çelişir).

**Karar:** Database-per-tenant modeli KORUNUYOR. "Gerçek multi-tenant SaaS'a
geçiş" seçimi şöyle uygulanacak:

1. **Holding katmanı gerçekten inşa edilecek** — bugüne kadar yalnızca prose
   olarak var olan ("bir holding altında birden fazla şirket olabilir")
   iddiayı gerçek bir `holdings` tablosu + `companies.holdingId` FK'sı ile
   somutlaştırmak. Bugün DB'de 4 `companies` satırı var ve birbirleriyle HİÇBİR
   ilişkisi yok — bu, "holding" kelimesinin şu ana kadar hiç kod karşılığı
   olmadığını kanıtlıyor.
2. **İç seviye izolasyon (company/branch/department) sertleştirilecek** —
   Explore taramasında bulunan gerçek risk: bu izolasyon 410 noktada TAMAMEN
   elle (`eq(table.companyId, companyId)`) uygulanıyor, RLS'in verdiği "unutsan
   bile DB seviyesinde durur" garantisi yok (bu, DATABASE-ARCHITECTURE.md §4'te
   zaten BİLİNÇLİ bir risk kabulü olarak yazılmıştı) ve 2026-08-29'da
   `requireDepartmentAccess`'te GERÇEK bir çapraz-şirket sızıntısı bulunup
   düzeltildi. Bunu satır-seviyesi RLS'e çevirmek yerine (MySQL'de native
   yok), **yapısal bir zorlama katmanı** eklenecek — TODO_TENANT_ENFORCEMENT
   (bkz. MASTER-ERP-ROADMAP.md Faz 0) altında detaylandırılacak.
3. **`HOLDING_ACCOUNT_PLAN_SCOPE` TODO'su** (TENANT-ARCHITECTURE.md §2'de
   açık bırakılmıştı — hesap planı company-başına mı holding-genelinde mi)
   Faz 0'da çözülecek: **company-başına** (gerçek muhasebe pratiği — ayrı
   tüzel kişilikler ayrı defter tutar), holding seviyesinde yalnızca
   KONSOLİDE RAPORLAMA (ayrı bir salt-okunur agregasyon katmanı, muhasebe
   fişlerinin kendisi değil) sağlanacak.
4. `DEPLOYMENT_MODEL`/`CENTRAL_REGISTRY` TODO'ları (TENANT-ARCHITECTURE.md §5)
   bu turun kapsamı DIŞINDA kalmaya devam ediyor — gerçek çoklu-fabrika
   provizyonu (her fabrikanın kendi sunucusu) operasyonel bir karar, bugünkü
   tek-Docker-konteyner test ortamını etkilemiyor.

Bu karar, master prompt'un kendi §1 karar sıralamasına (güvenlik → veri
bütünlüğü → ölçeklenebilirlik → bakım kolaylığı → mevzuat → performans → UX →
maliyet) göre de doğru: satır-seviyesi tenant_id'ye geçmek GÜVENLİĞİ artırmaz
(zaten en güçlü sınır — fiziksel DB izolasyonu — mevcut), veri bütünlüğünü
BOZAR (147 tabloluk riskli migrasyon), ve maliyeti (bu oturumun/haftaların
büyük kısmını salt-migrasyona harcamak) haklı çıkaracak bir kazanım
sağlamıyor.

## 2. Kapsam ve tempo — dürüst bir not

Bu yeni master prompt, önceki (KVKK/Güvenlik, 78 madde) prompt'un aksine, **var
olmayan onlarca yeni domain** istiyor: MES, BOM, MRP, EAM/Filo/Tesis, Proje/
Hukuk/Risk/Çevre/Ar-Ge, Hazine/Enerji, BI, Integration Hub/Event Bus, Feature
Flags — bunların HİÇBİRİ bugün mevcut değil (Explore taramasıyla doğrulandı).
Bu, gerçek bir kurumsal yazılımda tek başına aylar süren bir programdır. "Hiçbir
şeyi sonraya bırakmadan tamamla" talimatını, önceki KVKK turunda olduğu gibi
"tek oturumda 156 maddenin TAMAMINI kodla" olarak okumak, ya yüzeysel/test
edilmemiş bir taklit üretir ya da mevcut, ÇALIŞAN sistemi bozma riski taşır —
ikisi de Kural 2'yi ihlal eder. Bunun yerine: **MASTER-ERP-ROADMAP.md'de
tanımlanan fazlar sırayla, her faz sonunda gerçek test + commit ile**
ilerlenecek (tıpkı bu projenin HR/Procurement/Core-Security çalışmalarında
zaten kanıtlanmış disiplinle). Bu oturumda Faz 0 (tenant/Holding sertleştirme)
başlıyor; sonraki fazlar birbirini takip eder.

## 3. Diğer küçük varsayımlar

- `users.email` hâlâ global-unique (tüm 4 test şirketinde paylaşılan bir isim
  alanı) — bu, tek bir holding-DB içinde birden fazla şirket olsa bile makul
  bir basitleştirme (aynı holding'deki bir kullanıcı birden fazla şirkete
  erişebilir zaten `userDepartmentAccess` üzerinden). Değiştirilmedi.
- MySQL taahhüdü aynen sürüyor (master prompt §67 zaten bunu istiyor) —
  Postgres/RLS'e geçiş hiçbir noktada değerlendirilmedi.
- Mevcut 4 test şirketi (`Test Fabrika A.Ş.`, `Deneme Ahmet A.Ş.`,
  `ACCOUNTING TEST A.Ş.`, `Tenant B Test A.Ş.`) Faz 0'da tek bir "varsayılan
  holding" altına gruplanacak (geriye dönük uyumluluk — hiçbiri silinmeyecek).
