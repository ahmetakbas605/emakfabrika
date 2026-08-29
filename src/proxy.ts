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

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
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
