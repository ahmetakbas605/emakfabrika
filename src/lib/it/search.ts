import 'server-only';
import { eq, and, or, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { itAssets, serviceDeskTickets } from '@/db/schema';
import { searchIp } from '@/lib/it/ipam';

// IPAM.md §5'in verdiği söz: "192.168.1.25 arandığında hangi cihaz/
// kullanıcı/switch port/VLAN/ticket/lokasyon" — Faz 16'da (Reports/
// Dashboard) gerçek arama endpoint'i olarak kodlanacaktı, burada.
export interface GlobalSearchResult {
  assets: { id: string; assetTag: string; name: string }[];
  tickets: { id: string; ticketNo: string; title: string }[];
  ip: Awaited<ReturnType<typeof searchIp>> | null;
}

const IP_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export async function globalSearch(companyId: string, query: string): Promise<GlobalSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { assets: [], tickets: [], ip: null };

  const [assets, tickets, ipResult] = await Promise.all([
    db.select({ id: itAssets.id, assetTag: itAssets.assetTag, name: itAssets.name }).from(itAssets).where(and(eq(itAssets.companyId, companyId), or(like(itAssets.assetTag, `%${trimmed}%`), like(itAssets.name, `%${trimmed}%`), like(itAssets.serialNumber, `%${trimmed}%`)))),
    db.select({ id: serviceDeskTickets.id, ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title }).from(serviceDeskTickets).where(and(eq(serviceDeskTickets.companyId, companyId), or(like(serviceDeskTickets.ticketNo, `%${trimmed}%`), like(serviceDeskTickets.title, `%${trimmed}%`)))),
    IP_PATTERN.test(trimmed) ? searchIp(companyId, trimmed) : Promise.resolve(null)
  ]);

  return { assets, tickets, ip: ipResult };
}
