# SERVICE-DESK.md

Faz 6-7 kapsamı: Ticket/Incident/Problem/Change. Şema özeti IT-ARCHITECTURE.md
§3'te — bu belge davranış/motor tasarımını içerir.

## 1. Ticket durum makinesi (madde 50-51)

Çek/Senet'te kurulan (lib/checks.ts) "geçerli geçiş tablosu + tanımsız
geçiş reddedilir" DESENİ burada da kullanılacak:

```
TICKET_TRANSITIONS = {
  NEW: [TRIAGED, ASSIGNED],
  TRIAGED: [ASSIGNED],
  ASSIGNED: [ACCEPTED, ON_THE_WAY],  -- saha işi ise
  ACCEPTED: [ON_THE_WAY, WORKING],
  ON_THE_WAY: [ARRIVED],
  ARRIVED: [INSPECTION],
  INSPECTION: [WORKING],
  WORKING: [WAITING, TESTING],
  WAITING: [WORKING],
  TESTING: [RESOLVED, WORKING],       -- test başarısız → WORKING'e döner
  RESOLVED: [USER_APPROVAL_PENDING],  -- madde 50: doğrudan CLOSED'a geçilemez
  USER_APPROVAL_PENDING: [CLOSED, WORKING],  -- kullanıcı reddederse WORKING
  CLOSED: []  -- yalnızca REOPEN yetkisiyle (requirePermission('approve') gibi) açılabilir
}
```

`CLOSED → WORKING` "rastgele yapılamaz" (madde 207) — bu geçiş
TICKET_TRANSITIONS tablosunda YOK, ayrı bir `reopenTicket()` fonksiyonu
(yetkili kullanıcı, `requireDepartmentAccess(deptId, 'approve')`) `CLOSED`
durumundan `WORKING`'e AÇIKÇA, farklı bir kod yolundan geçer — kazayla
"normal" bir geçişmiş gibi çağrılamaz.

## 2. SLA hesaplama motoru (madde 28-29, 118, 188-189)

```
resolveSlaDeadline(ticket, slaPolicy, businessHours, holidayCalendar):
  1. ticket.createdAt'ten başlayarak slaPolicy.responseMinutes/
     resolutionHours kadar süre EKLE
  2. Eklenen süre, business_hours dışında geçen zamanı SAYMAZ (ör. 17:00'de
     açılan bir "response: 30 dk" ticket, mesai 18:00'de bitiyorsa, ertesi
     gün 08:30'a kadar KAYMAZ — TODO: SLA_AFTER_HOURS_POLICY, PDF net değil,
     iki makul yorum var: "hemen 30dk sonra dolsun" vs "mesai saatine kaydır",
     kullanıcıya sorulacak, şimdilik "mesai saatine kaydır" varsayımıyla
     kodlanacak ama bu bir TAHMİN, LEGAL_REVIEW değil ama BUSINESS_REVIEW
     gerektiriyor)
  3. holiday_calendars'taki günler tamamen ATLANIR (mesai dışı gibi sayılır)
```

Bu, tarih-saat aritmetiğinde GERÇEKTEN hataya açık bir alan — Faz 6'da
gerçek test senaryolarıyla (mesai dışı açılan ticket, tatil gününe denk
gelen SLA, hafta sonu) doğrulanacak, Muhasebe'nin dönem/tarih testleriyle
AYNI titizlikte.

## 3. Otomatik kategori/öncelik önerisi (madde 35, 147-148)

AI-hazır ama AI OLMADAN da çalışan bir "kural tabanlı öneri" katmanı: basit
anahtar kelime eşleştirme (`"yazıcı" → Printer kategorisi`) — PDF madde 35'in
"kritik kararlar onay gerektirebilir" ilkesiyle, bu ÖNERİ asla otomatik
UYGULANMAZ, yalnızca formda ön-doldurulmuş bir değer olarak gösterilir,
kullanıcı değiştirebilir. Gerçek AI entegrasyonu Faz 18'e ertelendi.

## 4. Atama (madde 36-38)

```
ticket_assignments (id, ticket_id FK, user_id FK, role ENUM('LEADER','MEMBER'), assigned_at)
```

Tam olarak BİR `LEADER` satırı ZORUNLU (uygulama-katmanı kontrol — DB
constraint ile "tam bir tane" ifade etmek pratik değil, MySQL'de partial
unique index yok). `assignTicket()` fonksiyonu leader ataması olmadan
tamamlanmaz, transaction içinde kontrol edilir.

## 5. Incident/Problem ilişkisi (madde 55-57)

`problem_incidents` (N:N) — bir problem'e birden fazla incident bağlanabilir
(madde 56: "20 incident → 1 problem"). Problem KAPANDIĞINDA bağlı
incident'lar OTOMATİK kapanmaz (PDF bunu istemiyor) — yalnızca
`problems.status` değişir, incident'ların kendi durumu bağımsız kalır.

## 6. Change Management onay akışı (madde 58-60)

`changes.risk_level` × `changes.impact_level` → `change_approvals` gerekip
gerekmediğini belirler (LOW risk + LOW impact → onaysız `SCHEDULED`'a
geçebilir; HIGH/CRITICAL → `change_approvals` satırı ZORUNLU, en az bir
`APPROVED` kaydı olmadan `SCHEDULED`'a geçilemez). Bu eşik TENANT bazında
parametrik olacak (`TODO: CHANGE_APPROVAL_THRESHOLD_CONFIG`, madde 61'in
genel "parametrik kurallar" ilkesiyle tutarlı).

## 7. Timeline (madde 53)

Ayrı bir `ticket_timeline` tablosu AÇILMAYACAK — timeline, mevcut
`ticket_status_history` + `ticket_work_logs` + `ticket_comments` +
`audit_logs` (entity='service_desk_tickets') tablolarının BİRLEŞTİRİLİP
zaman sırasına göre sıralanmasıyla (uygulama katmanında, SQL UNION ile)
üretilir — PDF madde 87'nin "gereksiz tarama/duplikasyon yapma" ilkesiyle
tutarlı, aynı bilgiyi iki yerde tutmuyoruz.

## 8. Escalation (madde 119)

`sla_rules` üzerinde `escalation_chain` (JSON: `["TECHNICIAN","TEAM_LEADER",
"IT_MANAGER","COMPANY_ADMIN"]`) — zamanlanmış bir görev (Faz 3'te henüz
kurulmayan bir "scheduler" altyapısı gerektiriyor, PDF madde 190 — Muhasebe'de
hiç ihtiyaç olmamıştı çünkü Muhasebe'de zaman-tetiklemeli hiçbir iş yok, bu
IT'nin GERÇEKTEN yeni bir altyapı ihtiyacı: `TODO: SCHEDULER_INFRASTRUCTURE`,
Faz 3'ün bir parçası — node-cron benzeri in-process bir zamanlayıcı mı, yoksa
Windows Task Scheduler/cron ile dışarıdan tetiklenen bir HTTP endpoint mi,
karar gerekiyor, fabrikanın kendi sunucusunda 7/24 çalışan bir Node
sürecinin garantisi var mı yok mu buna bağlı).
