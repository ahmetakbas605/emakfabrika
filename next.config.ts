import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // emakerp/next.config.ts'teki AYNI gerekçe — Next.js 16 dev sunucusu
  // yalnızca kendi algıladığı "Local" origin'den gelen isteklere izin
  // verir, LAN IP'sinden test için ek origin eklenmesi gerekir.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.54"],

  // Faz 20 (Production Hardening) — /api/v1/* zaten kendi CORS
  // başlıklarını proxy.ts'te ayarlıyor (mobil istemciler için), bu genel
  // güvenlik başlıkları TÜM rotalara uygulanır. CSP bilinçli olarak
  // GEVŞEK bırakıldı (`unsafe-inline` script/style) — inline style
  // kullanan (bu projenin kendi UI deseni) ve Next.js'in kendi inline
  // hydration script'lerine ihtiyaç duyan bir uygulamada sıkı bir CSP
  // TODO: CSP_NONCE_STRATEGY gerektirir, üretim dağıtımı netleşmeden
  // (tek fabrika sunucusu, harici CDN yok) tahmin edilmeyecek.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' }
        ]
      }
    ];
  }
};

export default nextConfig;
