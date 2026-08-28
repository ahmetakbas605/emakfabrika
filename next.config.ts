import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // emakerp/next.config.ts'teki AYNI gerekçe — Next.js 16 dev sunucusu
  // yalnızca kendi algıladığı "Local" origin'den gelen isteklere izin
  // verir, LAN IP'sinden test için ek origin eklenmesi gerekir.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.54"]
};

export default nextConfig;
