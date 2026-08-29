import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { parties, partyRoles, partyAddresses, partyContacts, paymentTerms } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { CoreError } from '@/lib/core/errors';

export interface CreatePartyInput {
  partyType?: 'PERSON' | 'COMPANY';
  code?: string; // boşsa CARI-<yıl><sayaç> otomatik üretilir
  legalName: string;
  tradeName?: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  website?: string;
  currencyCode?: string;
  paymentTermId?: string;
  creditLimit?: number | string;
  roles: ('CUSTOMER' | 'SUPPLIER')[]; // madde 33 — BOTH, iki rol satırıyla karşılanır
}

// PDF madde 34 — PARTY modeli. roles boş bırakılamaz: bir cari kartının
// hiçbir rolü olmaması (ne müşteri ne tedarikçi) anlamsız bir durum, erken
// reddedilir.
export async function createParty(companyId: string, createdByUserId: string, input: CreatePartyInput): Promise<string> {
  if (input.roles.length === 0) throw new CoreError('En az bir rol (Müşteri/Tedarikçi) seçilmeli.');

  return db.transaction(async (tx) => {
    const id = newId();
    const code = input.code?.trim() || (await nextDocumentNo(tx, companyId, 'PARTY', 'CARI', new Date().getFullYear(), 6));

    await tx.insert(parties).values({
      id,
      companyId,
      partyType: input.partyType ?? 'COMPANY',
      code,
      legalName: input.legalName,
      tradeName: input.tradeName ?? '',
      taxNumber: input.taxNumber ?? '',
      taxOffice: input.taxOffice ?? '',
      email: input.email ?? '',
      phone: input.phone ?? '',
      website: input.website ?? '',
      currencyCode: input.currencyCode,
      paymentTermId: input.paymentTermId,
      creditLimit: input.creditLimit === undefined ? undefined : String(input.creditLimit),
      createdByUserId
    });

    for (const role of input.roles) {
      await tx.insert(partyRoles).values({ id: newId(), partyId: id, role });
    }

    return id;
  });
}

export interface ListPartiesFilter {
  role?: 'CUSTOMER' | 'SUPPLIER';
  search?: string;
}

export async function listParties(companyId: string, filter?: ListPartiesFilter) {
  const conditions = [eq(parties.companyId, companyId), eq(parties.active, true)];
  const rows = await db
    .select({
      id: parties.id,
      code: parties.code,
      legalName: parties.legalName,
      tradeName: parties.tradeName,
      taxNumber: parties.taxNumber,
      email: parties.email,
      phone: parties.phone,
      currencyCode: parties.currencyCode
    })
    .from(parties)
    .where(and(...conditions));

  const roleRows = await db.select({ partyId: partyRoles.partyId, role: partyRoles.role }).from(partyRoles).where(eq(partyRoles.active, true));
  const rolesByParty = new Map<string, string[]>();
  for (const r of roleRows) {
    if (!rolesByParty.has(r.partyId)) rolesByParty.set(r.partyId, []);
    rolesByParty.get(r.partyId)!.push(r.role);
  }

  let result = rows.map((p) => ({ ...p, roles: rolesByParty.get(p.id) ?? [] }));
  if (filter?.role) result = result.filter((p) => p.roles.includes(filter.role!));
  if (filter?.search) {
    const term = filter.search.toLocaleLowerCase('tr');
    result = result.filter((p) => p.legalName.toLocaleLowerCase('tr').includes(term) || p.code.toLocaleLowerCase('tr').includes(term) || p.taxNumber.includes(term));
  }
  return result;
}

export async function getParty(companyId: string, partyId: string) {
  const [party] = await db.select().from(parties).where(and(eq(parties.id, partyId), eq(parties.companyId, companyId))).limit(1);
  if (!party) throw new CoreError('Cari kartı bulunamadı.');

  const [roles, addresses, contacts] = await Promise.all([
    db.select().from(partyRoles).where(and(eq(partyRoles.partyId, partyId), eq(partyRoles.active, true))),
    db.select().from(partyAddresses).where(eq(partyAddresses.partyId, partyId)),
    db.select().from(partyContacts).where(eq(partyContacts.partyId, partyId))
  ]);

  return { party, roles: roles.map((r) => r.role), addresses, contacts };
}

export interface AddPartyAddressInput {
  addressType?: 'BILLING' | 'SHIPPING' | 'OTHER';
  label?: string;
  addressLine?: string;
  city?: string;
  district?: string;
  country?: string;
  isDefault?: boolean;
}

export async function addPartyAddress(companyId: string, partyId: string, input: AddPartyAddressInput): Promise<string> {
  const [party] = await db.select({ id: parties.id }).from(parties).where(and(eq(parties.id, partyId), eq(parties.companyId, companyId))).limit(1);
  if (!party) throw new CoreError('Cari kartı bulunamadı.');

  const id = newId();
  await db.insert(partyAddresses).values({
    id,
    partyId,
    addressType: input.addressType ?? 'OTHER',
    label: input.label ?? '',
    addressLine: input.addressLine,
    city: input.city ?? '',
    district: input.district ?? '',
    country: input.country ?? 'Türkiye',
    isDefault: input.isDefault ?? false
  });
  return id;
}

export interface AddPartyContactInput {
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export async function addPartyContact(companyId: string, partyId: string, input: AddPartyContactInput): Promise<string> {
  const [party] = await db.select({ id: parties.id }).from(parties).where(and(eq(parties.id, partyId), eq(parties.companyId, companyId))).limit(1);
  if (!party) throw new CoreError('Cari kartı bulunamadı.');

  const id = newId();
  await db.insert(partyContacts).values({
    id,
    partyId,
    fullName: input.fullName,
    title: input.title ?? '',
    email: input.email ?? '',
    phone: input.phone ?? '',
    isPrimary: input.isPrimary ?? false
  });
  return id;
}

// --- Ödeme Vadesi (madde 38) — Party'nin dışında, bağımsız bir master. ---

export async function createPaymentTerm(companyId: string, code: string, name: string, netDays: number): Promise<string> {
  const id = newId();
  await db.insert(paymentTerms).values({ id, companyId, code, name, netDays });
  return id;
}

export async function listPaymentTerms(companyId: string) {
  return db.select().from(paymentTerms).where(and(eq(paymentTerms.companyId, companyId), eq(paymentTerms.active, true)));
}
