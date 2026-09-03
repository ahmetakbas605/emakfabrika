import type { NextConfig } from "next";

// Güvenlik denetimi 2026-09-03, bulgu 2.4 — eski yorum CSP'nin "bilinçli
// olarak gevşek bırakıldığını" söylüyordu ama gerçekte header HİÇ
// tanımlı değildi (gevşek CSP ile CSP'siz aynı şey değil). Tam bir
// nonce/strict-dynamic CSP hâlâ TODO: CSP_NONCE_STRATEGY (bu projenin
// inline style deseni + Next.js'in hydration script'leri için nonce
// enjeksiyonu ayrı bir altyapı işi) — ama `unsafe-inline` script/style
// İLE BİRLİKTE bile connect-src/img-src/font-src'i 'self'e (+ globals.css'in
// gerçekten kullandığı Google Fonts) kilitlemek somut bir kazanç: bir XSS
// payload'ı çalışsa bile veriyi rastgele bir dış sunucuya sızdıramaz,
// rastgele bir dış script/iframe yükleyemez.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

const nextConfig: NextConfig = {
  // emakerp/next.config.ts'teki AYNI gerekçe — Next.js 16 dev sunucusu
  // yalnızca kendi algıladığı "Local" origin'den gelen isteklere izin
  // verir, LAN IP'sinden test için ek origin eklenmesi gerekir.
  // "fabrika.emakbilisim.keenetic.link" — emakerp'in "erp." adresiyle AYNI
  // desende, Keenetic KeenDNS ile bu PC'ye dışarıdan erişim için (emakerp
  // login'inin fabrika kullanıcılarını buraya yönlendirebilmesi için) —
  // kullanıcı kendi Keenetic router panelinden bu alt alan adını port
  // 3221'e yönlendirmeli, uygulama tarafı buna göre HAZIR.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.54", "fabrika.emakbilisim.keenetic.link"],

  // Güvenlik denetimi 2026-09-03, bulgu 2.9 — X-Powered-By: Next.js
  // header'ı framework'ü ifşa ediyordu, hiçbir işlevsel faydası yok.
  poweredByHeader: false,

  // Faz 20 (Production Hardening) — /api/v1/* zaten kendi CORS
  // başlıklarını proxy.ts'te ayarlıyor (mobil istemciler için), bu genel
  // güvenlik başlıkları TÜM rotalara uygulanır.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Content-Security-Policy', value: CSP },
          // Güvenlik denetimi 2026-09-03, bulgu 2.4 — TLS'in NEREDE
          // sonlandığından (Next.js'in kendisi mi, Keenetic router mı)
          // bağımsız olarak zararsız: yanıt yalnızca GERÇEKTEN HTTPS
          // üzerinden ulaşırsa tarayıcı bu header'ı dikkate alır, düz
          // HTTP yanıtlarında tarayıcı zaten görmezden gelir.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }
        ]
      }
    ];
  }
};

export default nextConfig;
