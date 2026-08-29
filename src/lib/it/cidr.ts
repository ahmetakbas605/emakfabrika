// IPAM.md §1 — saf IPv4 CIDR aritmetiği, harici kütüphane yok. IPv6 aralık
// hesaplaması bilinçli olarak YOK (TODO: IPV6_RANGE_MATH — bugüne kadar
// hiçbir PDF maddesi IPv6'ya somut bir ihtiyaç göstermedi, fabrika LAN'ları
// için IPv4 yeterli varsayımıyla ertelendi; ip_addresses.ip_version alanı
// IPV6 değerini KABUL EDER, yalnızca otomatik "boş adres" hesaplaması
// IPv4'e özel).
const MAX_ENUMERABLE_HOSTS = 4096; // /20 ve altı — daha büyük bloklar için TODO: IP_RANGE_PAGINATION

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Geçersiz IPv4 adresi: ${ip}`);
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export interface ParsedCidr {
  network: number;
  prefixLength: number;
  broadcast: number;
  hostCount: number;
}

export function parseCidr(cidr: string): ParsedCidr {
  const [base, prefixStr] = cidr.trim().split('/');
  const prefixLength = Number(prefixStr);
  if (!base || Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new Error(`Geçersiz CIDR: ${cidr}`);
  }
  const baseInt = ipToInt(base);
  const hostBits = 32 - prefixLength;
  const mask = hostBits === 32 ? 0 : (0xffffffff << hostBits) >>> 0;
  const network = (baseInt & mask) >>> 0;
  const broadcast = (network | (hostBits === 32 ? 0xffffffff : ~mask >>> 0)) >>> 0;
  return { network, prefixLength, broadcast, hostCount: broadcast - network + 1 };
}

// Kullanılabilir host aralığı: network ve broadcast adresleri HARİÇ
// (standart IPv4 alt ağ kuralı) — /31, /32 gibi özel durumlarda boş dönebilir.
export function listUsableHostIps(cidr: string): { ips: string[]; truncated: boolean } {
  const parsed = parseCidr(cidr);
  const firstHost = parsed.prefixLength >= 31 ? parsed.network : parsed.network + 1;
  const lastHost = parsed.prefixLength >= 31 ? parsed.broadcast : parsed.broadcast - 1;
  const total = Math.max(0, lastHost - firstHost + 1);
  const truncated = total > MAX_ENUMERABLE_HOSTS;
  const limit = truncated ? MAX_ENUMERABLE_HOSTS : total;

  const ips: string[] = [];
  for (let i = 0; i < limit; i++) ips.push(intToIp(firstHost + i));
  return { ips, truncated };
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  const ipInt = ipToInt(ip);
  return ipInt >= parsed.network && ipInt <= parsed.broadcast;
}
