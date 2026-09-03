import { NextResponse, type NextRequest } from 'next/server';

// /api/v1/* MOBİL istemciler (ITAndroid, ileride diğer departman
// uygulamaları) için — native RN fetch, tarayıcı CORS kısıtına tabi
// DEĞİLDİR (emakadroid/emakerp'in /api/mobile ucunda da CORS başlığı yok),
// bu yüzden gerçek cihazda bu başlıklar olmasa da çalışır. Ama Expo web
// önizlemesi (Metro dev server, ayrı origin) tarayıcı CORS'una tabi olduğu
// için buradaki başlıklar olmadan preflight'ta engellenir — bu middleware
// yalnızca bu yüzden var, geniş bir güvenlik gevşetmesi DEĞİL (kimlik
// doğrulama zaten Authorization bearer token ile yapılıyor, çerez/oturum
// tabanlı DEĞİL, bu yüzden CSRF riski taşımıyor).
//
// Next.js 16'da "middleware" dosya kuralı "proxy" olarak yeniden adlandırıldı
// (bkz. node_modules/next/dist/docs/.../proxy.md) — AGENTS.md'nin "deprecation
// notlarına uy" talimatı gereği baştan proxy.ts olarak yazıldı.
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

// Güvenlik denetimi 2026-09-03, bulgu 2.13 — hesap-bazlı kilitleme
// (actions/auth.ts, lib/mobile-auth.ts — bulgu 2.5) dışında hiçbir uç
// IP-bazlı bir hız sınırlamasına tabi değildi; uygulama artık dışarıdan
// erişilebilir (fabrika.emakbilisim.keenetic.link, bkz.
// feedback_dev_server_sandbox_network hafıza notu). Tek fabrika sunucusu
// (cluster YOK) olduğu için bellek-içi bir pencere sayacı yeterli —
// lib/session.ts:consumedHandoffJtis İLE AYNI gerekçe/desen. Yalnızca
// giriş/handoff UÇLARINI (POST /api/v1/auth/login,
// /api/v1/auth/handoff) kapsar — web /login Server Action'ını burada
// aynı şekilde kesmek riskli (Next.js'in RSC action protokolünü bozabilir,
// bkz. commit yorumu); o zaten hesap-bazlı geçici kilitle korunuyor.
const RATE_LIMITED_PATHS = new Set(['/api/v1/auth/login', '/api/v1/auth/handoff']);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: NextRequest): boolean {
  if (!RATE_LIMITED_PATHS.has(request.nextUrl.pathname)) return false;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  if (rateLimitBuckets.size > 5000) {
    for (const [k, bucket] of rateLimitBuckets) {
      if (bucket.resetAt < now) rateLimitBuckets.delete(k);
    }
  }

  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    return res;
  }

  if (request.method === 'POST' && isRateLimited(request)) {
    const res = NextResponse.json({ error: 'Çok fazla istek — lütfen bir dakika sonra tekrar deneyin.' }, { status: 429 });
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  }

  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  return res;
}

export const config = {
  matcher: '/api/v1/:path*'
};
