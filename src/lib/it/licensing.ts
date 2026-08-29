import 'server-only';
import { eq, and, desc, lte, count, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  vendors, softwareProducts, softwareInstallations, softwareLicenses, licenseAssignments,
  warranties, contracts, contractAssets, itAssets
} from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// Faz 10 — License/Warranty/Contract. "Süre uyarıları" (IT-ARCHITECTURE.md
// §2 modül listesi) bir scheduler görevi/bildirimi GEREKTİRMİYOR — bitiş
// tarihi zaten kalıcı bir alan, "yaklaşan" olup olmadığı SAF bir tarih
// karşılaştırması (aşağıdaki listExpiring* fonksiyonları). Escalation'ın
// aksine (SERVICE-DESK.md §8) burada durumsal bir "olay" YOK, sadece canlı
// bir sorgu — bu yüzden ayrı bir "alert" tablosu/scheduler görevi AÇILMADI,
// gereksiz bir soyutlama olurdu (PDF madde 87'nin ilkesiyle tutarlı).
const EXPIRING_SOON_DAYS = 30;

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Vendor ---

export interface CreateVendorInput {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  accountingAccountId?: string;
}

export async function createVendor(companyId: string, input: CreateVendorInput): Promise<string> {
  const id = newId();
  await db.insert(vendors).values({ id, companyId, ...input });
  return id;
}

export async function listVendors(companyId: string) {
  return db.select().from(vendors).where(and(eq(vendors.companyId, companyId), eq(vendors.active, true)));
}

// --- Software Product / Installation ---

export async function createSoftwareProduct(companyId: string, input: { name: string; publisher?: string; vendorId?: string }): Promise<string> {
  const id = newId();
  await db.insert(softwareProducts).values({ id, companyId, name: input.name, publisher: input.publisher ?? '', vendorId: input.vendorId });
  return id;
}

export async function listSoftwareProducts(companyId: string) {
  return db
    .select({ id: softwareProducts.id, name: softwareProducts.name, publisher: softwareProducts.publisher, vendorName: vendors.name })
    .from(softwareProducts)
    .leftJoin(vendors, eq(vendors.id, softwareProducts.vendorId))
    .where(eq(softwareProducts.companyId, companyId));
}

export async function createInstallation(companyId: string, input: { productId: string; assetId: string; installedVersion?: string }): Promise<string> {
  const id = newId();
  await db.insert(softwareInstallations).values({ id, companyId, productId: input.productId, assetId: input.assetId, installedVersion: input.installedVersion ?? '' });
  return id;
}

export async function listInstallations(companyId: string) {
  return db
    .select({
      id: softwareInstallations.id, productName: softwareProducts.name, assetTag: itAssets.assetTag, assetName: itAssets.name,
      installedVersion: softwareInstallations.installedVersion, installedAt: softwareInstallations.installedAt
    })
    .from(softwareInstallations)
    .innerJoin(softwareProducts, eq(softwareProducts.id, softwareInstallations.productId))
    .innerJoin(itAssets, eq(itAssets.id, softwareInstallations.assetId))
    .where(eq(softwareInstallations.companyId, companyId))
    .orderBy(desc(softwareInstallations.installedAt));
}

// --- Software License ---

export interface CreateLicenseInput {
  productId: string;
  vendorId?: string;
  licenseKey?: string;
  seats?: number;
  purchaseDate?: string;
  expiresAt?: string;
  cost?: number | string;
}

export async function createLicense(companyId: string, input: CreateLicenseInput): Promise<string> {
  const id = newId();
  await db.insert(softwareLicenses).values({
    id, companyId, productId: input.productId, vendorId: input.vendorId, licenseKey: input.licenseKey ?? '',
    seats: input.seats ?? 1, purchaseDate: input.purchaseDate, expiresAt: input.expiresAt,
    cost: input.cost !== undefined ? String(input.cost) : undefined
  });
  return id;
}

export async function listLicenses(companyId: string) {
  const rows = await db
    .select({
      id: softwareLicenses.id, productName: softwareProducts.name, vendorName: vendors.name, seats: softwareLicenses.seats,
      expiresAt: softwareLicenses.expiresAt, cost: softwareLicenses.cost
    })
    .from(softwareLicenses)
    .innerJoin(softwareProducts, eq(softwareProducts.id, softwareLicenses.productId))
    .leftJoin(vendors, eq(vendors.id, softwareLicenses.vendorId))
    .where(eq(softwareLicenses.companyId, companyId));

  const usage = await db.select({ licenseId: licenseAssignments.licenseId, used: count() }).from(licenseAssignments).groupBy(licenseAssignments.licenseId);
  const usedByLicense = new Map(usage.map((u) => [u.licenseId, u.used]));

  return rows.map((r) => ({ ...r, usedSeats: usedByLicense.get(r.id) ?? 0 }));
}

// PDF: "License Management + süre uyarıları" — bitişi EXPIRING_SOON_DAYS
// içinde olan (ve henüz geçmemiş) lisanslar.
export async function listExpiringLicenses(companyId: string) {
  return db
    .select({ id: softwareLicenses.id, productName: softwareProducts.name, expiresAt: softwareLicenses.expiresAt })
    .from(softwareLicenses)
    .innerJoin(softwareProducts, eq(softwareProducts.id, softwareLicenses.productId))
    .where(and(eq(softwareLicenses.companyId, companyId), lte(softwareLicenses.expiresAt, daysFromNowIso(EXPIRING_SOON_DAYS))));
}

// Bir kurulum EN FAZLA bir lisansa bağlanabilir, koltuk sayısı aşılamaz —
// ticket_assignments'taki tek-LEADER kontrolüyle AYNI uygulama-katmanı
// disiplini.
export async function assignLicenseSeat(companyId: string, licenseId: string, installationId: string): Promise<void> {
  const [license] = await db.select({ id: softwareLicenses.id, seats: softwareLicenses.seats }).from(softwareLicenses).where(and(eq(softwareLicenses.id, licenseId), eq(softwareLicenses.companyId, companyId))).limit(1);
  if (!license) throw new ItError('Lisans bulunamadı.');

  const [{ value: usedSeats }] = await db.select({ value: count() }).from(licenseAssignments).where(eq(licenseAssignments.licenseId, licenseId));
  if (usedSeats >= license.seats) throw new ItError(`Tüm koltuklar (${license.seats}) kullanımda — yeni koltuk atanamaz.`);

  const [existing] = await db.select({ id: licenseAssignments.id }).from(licenseAssignments).where(eq(licenseAssignments.installationId, installationId)).limit(1);
  if (existing) throw new ItError('Bu kurulum zaten bir lisansa atanmış.');

  await db.insert(licenseAssignments).values({ id: newId(), licenseId, installationId });
}

export async function listUnassignedInstallations(companyId: string) {
  return db
    .select({ id: softwareInstallations.id, productName: softwareProducts.name, assetTag: itAssets.assetTag })
    .from(softwareInstallations)
    .innerJoin(softwareProducts, eq(softwareProducts.id, softwareInstallations.productId))
    .innerJoin(itAssets, eq(itAssets.id, softwareInstallations.assetId))
    .leftJoin(licenseAssignments, eq(licenseAssignments.installationId, softwareInstallations.id))
    .where(and(eq(softwareInstallations.companyId, companyId), isNull(licenseAssignments.id)));
}

// --- Warranty ---
// it_assets.warrantyStart/warrantyEnd ile KARIŞTIRILMASIN — bkz. schema.ts
// notu, bu tam geçmiş/detay tablosu.

export interface CreateWarrantyInput {
  assetId: string;
  vendorId?: string;
  startDate: string;
  endDate: string;
  terms?: string;
  cost?: number | string;
}

export async function createWarranty(companyId: string, input: CreateWarrantyInput): Promise<string> {
  const id = newId();
  await db.insert(warranties).values({ id, companyId, assetId: input.assetId, vendorId: input.vendorId, startDate: input.startDate, endDate: input.endDate, terms: input.terms, cost: input.cost !== undefined ? String(input.cost) : undefined });
  return id;
}

export async function listWarranties(companyId: string) {
  return db
    .select({ id: warranties.id, assetTag: itAssets.assetTag, assetName: itAssets.name, vendorName: vendors.name, startDate: warranties.startDate, endDate: warranties.endDate, cost: warranties.cost })
    .from(warranties)
    .innerJoin(itAssets, eq(itAssets.id, warranties.assetId))
    .leftJoin(vendors, eq(vendors.id, warranties.vendorId))
    .where(eq(warranties.companyId, companyId))
    .orderBy(desc(warranties.endDate));
}

export async function listExpiringWarranties(companyId: string) {
  return db
    .select({ id: warranties.id, assetTag: itAssets.assetTag, endDate: warranties.endDate })
    .from(warranties)
    .innerJoin(itAssets, eq(itAssets.id, warranties.assetId))
    .where(and(eq(warranties.companyId, companyId), lte(warranties.endDate, daysFromNowIso(EXPIRING_SOON_DAYS))));
}

// --- Contract ---

export interface CreateContractInput {
  title: string;
  contractType: (typeof contracts.$inferInsert)['contractType'];
  vendorId?: string;
  startDate: string;
  endDate: string;
  cost?: number | string;
  assetIds?: string[];
}

export async function createContract(companyId: string, input: CreateContractInput): Promise<string> {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(contracts).values({ id, companyId, title: input.title, contractType: input.contractType, vendorId: input.vendorId, startDate: input.startDate, endDate: input.endDate, cost: input.cost !== undefined ? String(input.cost) : undefined });
    if (input.assetIds && input.assetIds.length > 0) {
      await tx.insert(contractAssets).values(input.assetIds.map((assetId) => ({ contractId: id, assetId })));
    }
  });
  return id;
}

export async function listContracts(companyId: string) {
  return db
    .select({ id: contracts.id, title: contracts.title, contractType: contracts.contractType, vendorName: vendors.name, startDate: contracts.startDate, endDate: contracts.endDate, cost: contracts.cost })
    .from(contracts)
    .leftJoin(vendors, eq(vendors.id, contracts.vendorId))
    .where(eq(contracts.companyId, companyId))
    .orderBy(desc(contracts.endDate));
}

export async function listExpiringContracts(companyId: string) {
  return db
    .select({ id: contracts.id, title: contracts.title, endDate: contracts.endDate })
    .from(contracts)
    .where(and(eq(contracts.companyId, companyId), lte(contracts.endDate, daysFromNowIso(EXPIRING_SOON_DAYS))));
}

export async function listContractAssets(contractId: string) {
  return db.select({ assetId: itAssets.id, assetTag: itAssets.assetTag, assetName: itAssets.name }).from(contractAssets).innerJoin(itAssets, eq(itAssets.id, contractAssets.assetId)).where(eq(contractAssets.contractId, contractId));
}
