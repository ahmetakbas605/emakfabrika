import 'server-only';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { positions, users, approvalDelegations } from '@/db/schema';
import { newId } from '@/lib/id';
import { CoreError } from '@/lib/core/errors';

// SATINALMA-MİMARİSİ Faz 0 — madde 4-6. Sabit bir seviye listesi (Ustabaşı/
// Şef/Müdür gibi) YOK, her şirket kendi unvanlarını approvalLevel ile
// tanımlar. Bu dosya procurement'a özel değil — platform geneli.

export interface CreatePositionInput {
  code: string;
  title: string;
  approvalLevel?: number;
}

export async function createPosition(companyId: string, input: CreatePositionInput): Promise<string> {
  const id = newId();
  await db.insert(positions).values({ id, companyId, code: input.code, title: input.title, approvalLevel: input.approvalLevel ?? 0 });
  return id;
}

export async function listPositions(companyId: string) {
  return db.select().from(positions).where(and(eq(positions.companyId, companyId), eq(positions.active, true)));
}

// madde 5 — kullanıcının pozisyon/yönetici ataması. İkisi de opsiyonel;
// managerUserId AYNI şirketten olmalı (cross-company bir yönetici zinciri
// anlamsız — IT-SECURITY.md §6'nın kiracı izolasyonu disipliniyle AYNI).
export async function setUserOrgAssignment(companyId: string, userId: string, positionId?: string, managerUserId?: string): Promise<void> {
  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.companyId, companyId))).limit(1);
  if (!user) throw new CoreError('Kullanıcı bulunamadı.');

  if (positionId) {
    const [position] = await db.select({ id: positions.id }).from(positions).where(and(eq(positions.id, positionId), eq(positions.companyId, companyId))).limit(1);
    if (!position) throw new CoreError('Pozisyon bulunamadı.');
  }
  if (managerUserId) {
    if (managerUserId === userId) throw new CoreError('Bir kullanıcı kendi yöneticisi olamaz.');
    const [manager] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, managerUserId), eq(users.companyId, companyId))).limit(1);
    if (!manager) throw new CoreError('Yönetici bulunamadı.');
  }

  await db.update(users).set({ positionId: positionId ?? null, managerUserId: managerUserId ?? null }).where(eq(users.id, userId));
}

export interface OrgUserRow {
  id: string;
  fullName: string;
  email: string;
  positionId: string | null;
  positionTitle: string | null;
  managerUserId: string | null;
  managerName: string | null;
}

export async function listCompanyOrgUsers(companyId: string): Promise<OrgUserRow[]> {
  const rows = await db.select({ id: users.id, fullName: users.fullName, email: users.email, positionId: users.positionId, managerUserId: users.managerUserId }).from(users).where(eq(users.companyId, companyId));
  const positionRows = await listPositions(companyId);
  const positionById = new Map(positionRows.map((p) => [p.id, p.title]));
  const nameById = new Map(rows.map((r) => [r.id, r.fullName]));
  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    positionId: r.positionId,
    positionTitle: r.positionId ? (positionById.get(r.positionId) ?? null) : null,
    managerUserId: r.managerUserId,
    managerName: r.managerUserId ? (nameById.get(r.managerUserId) ?? null) : null
  }));
}

// madde 6 — raporlama zinciri. Döngüsel bir yönetici ataması (A→B→A gibi
// bir veri hatası) sonsuz döngüye girmesin diye maxLevels ile sınırlı.
export async function getManagerChain(companyId: string, userId: string, maxLevels = 6): Promise<string[]> {
  const chain: string[] = [];
  let currentId: string | null = userId;
  const seen = new Set<string>();

  for (let i = 0; i < maxLevels; i++) {
    if (!currentId || seen.has(currentId)) break;
    seen.add(currentId);
    const [row] = await db.select({ managerUserId: users.managerUserId }).from(users).where(and(eq(users.id, currentId), eq(users.companyId, companyId))).limit(1);
    if (!row?.managerUserId) break;
    chain.push(row.managerUserId);
    currentId = row.managerUserId;
  }
  return chain;
}

// --- Vekalet (madde 8-9) — zaman aralığı bazlı, kullanıcının TÜM gelecek
// onaylarını devreder (workflow/engine.ts'teki adım-bazlı tekil DELEGATE
// aksiyonundan farklı, bkz. schema.ts yorumu). ---

export interface CreateDelegationInput {
  delegatorUserId: string;
  delegateUserId: string;
  startsAt: Date;
  endsAt: Date;
}

export async function createDelegation(companyId: string, input: CreateDelegationInput): Promise<string> {
  if (input.delegatorUserId === input.delegateUserId) throw new CoreError('Bir kullanıcı kendine vekalet veremez.');
  if (input.endsAt <= input.startsAt) throw new CoreError('Bitiş tarihi başlangıçtan sonra olmalı.');

  const [delegate] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.delegateUserId), eq(users.companyId, companyId))).limit(1);
  if (!delegate) throw new CoreError('Vekalet edilecek kullanıcı bulunamadı.');

  const id = newId();
  await db.insert(approvalDelegations).values({
    id, companyId,
    delegatorUserId: input.delegatorUserId,
    delegateUserId: input.delegateUserId,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  });
  return id;
}

export async function listDelegations(companyId: string) {
  return db.select().from(approvalDelegations).where(eq(approvalDelegations.companyId, companyId));
}

export async function deactivateDelegation(companyId: string, delegationId: string): Promise<void> {
  const [row] = await db.select({ id: approvalDelegations.id }).from(approvalDelegations).where(and(eq(approvalDelegations.id, delegationId), eq(approvalDelegations.companyId, companyId))).limit(1);
  if (!row) throw new CoreError('Vekalet kaydı bulunamadı.');
  await db.update(approvalDelegations).set({ active: false }).where(eq(approvalDelegations.id, delegationId));
}

// Belirli bir anda (varsayılan: şimdi) bu kullanıcı yerine kimin karar
// vereceğini çözer — aktif bir vekalet varsa devralan döner, yoksa
// kullanıcının kendisi.
export async function resolveActiveApprover(companyId: string, userId: string, at: Date = new Date()): Promise<string> {
  const [delegation] = await db
    .select({ delegateUserId: approvalDelegations.delegateUserId })
    .from(approvalDelegations)
    .where(and(eq(approvalDelegations.companyId, companyId), eq(approvalDelegations.delegatorUserId, userId), eq(approvalDelegations.active, true), lte(approvalDelegations.startsAt, at), gte(approvalDelegations.endsAt, at)))
    .limit(1);
  return delegation?.delegateUserId ?? userId;
}
