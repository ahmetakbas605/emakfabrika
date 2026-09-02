// Görsel Yenileme Faz 0 — HAREKET BÜTÇESİ (motion budget).
//
// Kullanıcının kararı bana bırakıldı ("hızlı olması gereken sayfaların
// stabilite kararı sende"). Karar: hareket miktarı sayfanın İŞİNE göre
// belirlenir, tasarımcının o an ne hissettiğine göre değil — ve bu ROTADAN
// TÜRETİLİR, her sayfada elle hatırlanması gereken bir bayrak DEĞİLDİR
// (lib/permissions.ts'in "izin rotanın kendisinden türer" deseniyle AYNI ruh).
//
// Gerekçe: bu bir fabrika ERP'si. Üretim emri giren operatör ile BI panosuna
// bakan CEO'nun hareket toleransı AYNI DEĞİL. Tezgâh başındaki kullanıcı
// günde yüzlerce kez aynı formu açar — 500ms'lik zarif bir geçiş, 100 kayıt
// sonra 50 saniyelik kayıp demektir ve odak kaybettirir. Buna karşılık
// Dashboard/BI günde birkaç kez açılır ve ORADA anlatım değerlidir.
//
// Bu yüzden TEK bir "animasyon açık/kapalı" anahtarı YOK; üç kademe var.

export const MOTION_TIERS = ['STAGE', 'FLOW', 'WORKBENCH'] as const;
export type MotionTier = (typeof MOTION_TIERS)[number];

// STAGE (Sahne) — anlatım yüzeyleri. Günde birkaç kez açılır, kullanıcı
//   "bakar", veri girmez. 3D perspektif, parallax, kademeli açılış serbest.
// FLOW (Akış) — gezinme yüzeyleri. Liste→detay, rapor okuma. Paylaşılan
//   eleman geçişi var ama dekoratif hareket yok.
// WORKBENCH (Tezgâh) — veri girişi. Form, tablo, kayıt. Yalnızca opaklık,
//   ASLA layout kaydıran transform. Gönder→geri bildirim ANINDA olmalı.

// Rota ön ekleri. En UZUN eşleşme kazanır (specificity), böylece
// '/dashboard' STAGE iken '/dashboard/production/orders' WORKBENCH kalabilir.
const TIER_RULES: { prefix: string; tier: MotionTier; exact?: boolean }[] = [
  // --- STAGE ---
  { prefix: '/login', tier: 'STAGE' },
  { prefix: '/dashboard', tier: 'STAGE', exact: true },
  { prefix: '/dashboard/bi', tier: 'STAGE' },
  { prefix: '/dashboard/holding', tier: 'STAGE' },
  { prefix: '/dashboard/integration', tier: 'STAGE' },
  { prefix: '/dashboard/security', tier: 'STAGE' },

  // --- WORKBENCH: yoğun veri girişi ---
  // Muhasebe fişi — bu uygulamadaki EN yoğun form (çift kayıt, çok satır).
  { prefix: '/dashboard/departments', tier: 'WORKBENCH' },
  { prefix: '/dashboard/master-data', tier: 'WORKBENCH' },
  { prefix: '/dashboard/procurement', tier: 'WORKBENCH' },
  { prefix: '/dashboard/production', tier: 'WORKBENCH' },
  { prefix: '/dashboard/mes', tier: 'WORKBENCH' },
  { prefix: '/dashboard/mrp', tier: 'WORKBENCH' },
  { prefix: '/dashboard/quality', tier: 'WORKBENCH' },
  { prefix: '/dashboard/sales', tier: 'WORKBENCH' },
  { prefix: '/dashboard/hr', tier: 'WORKBENCH' },
  { prefix: '/dashboard/eam', tier: 'WORKBENCH' },
  { prefix: '/dashboard/fleet', tier: 'WORKBENCH' },
  { prefix: '/dashboard/treasury', tier: 'WORKBENCH' },
  { prefix: '/dashboard/workflow', tier: 'WORKBENCH' },
  { prefix: '/dashboard/org', tier: 'WORKBENCH' }
];

// Kural bulunamazsa FLOW — güvenli orta yol. Yeni bir modül eklendiğinde
// otomatik olarak "abartısız ama ölü değil" davranır; birisi bilinçli
// karar verene kadar ne operatörü yavaşlatır ne de sahne gibi davranır.
const DEFAULT_TIER: MotionTier = 'FLOW';

export function resolveMotionTier(pathname: string): MotionTier {
  // Sondaki '/' normalize edilir ('/dashboard/' === '/dashboard').
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  let best: { tier: MotionTier; length: number } | null = null;
  for (const rule of TIER_RULES) {
    const matches = rule.exact ? path === rule.prefix : path === rule.prefix || path.startsWith(`${rule.prefix}/`);
    if (!matches) continue;
    if (!best || rule.prefix.length > best.length) best = { tier: rule.tier, length: rule.prefix.length };
  }
  return best?.tier ?? DEFAULT_TIER;
}

// Tek yönlü kısıtlama: bir sayfa kendi kademesini DÜŞÜREBİLİR ama ASLA
// YÜKSELTEMEZ. Gerekçe: yanlışlıkla bir veri-giriş ekranını "sahne" yapmak
// gerçek bir zarar (operatör yavaşlar); tersi yalnızca estetik bir kayıp.
// Bu, izin sisteminin "escalate edemezsin" ilkesinin UI karşılığı.
const TIER_WEIGHT: Record<MotionTier, number> = { STAGE: 3, FLOW: 2, WORKBENCH: 1 };

export function clampTier(routeTier: MotionTier, requested: MotionTier): MotionTier {
  return TIER_WEIGHT[requested] < TIER_WEIGHT[routeTier] ? requested : routeTier;
}

// CSS tarafının okuduğu süreler burada TEK KAYNAK — globals.css'teki
// --motion-* değişkenleriyle BİREBİR aynı olmalı. JS tarafında (framer-motion)
// aynı sayıları elle tekrar yazmamak için dışa açılıyor.
export const MOTION_DURATIONS: Record<MotionTier, { page: number; element: number }> = {
  STAGE: { page: 520, element: 420 },
  FLOW: { page: 260, element: 200 },
  // 120ms — Doherty eşiğinin (400ms) çok altında, kullanıcı "anında" algılar.
  WORKBENCH: { page: 120, element: 90 }
};
