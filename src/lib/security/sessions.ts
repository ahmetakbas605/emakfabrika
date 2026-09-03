import 'server-only';
import { eq, and, ne, gt } from 'drizzle-orm';
import { db } from '@/db/client';
import { userSessions, users } from '@/db/schema';
import { newId } from '@/lib/id';
import { generateSessionToken, hashToken, tokensMatch } from '@/lib/auth';

const SESSION_DAYS = 7;

export interface CreateSessionInput {
  companyId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  deviceLabel?: string;
}

// Güvenlik denetimi 2026-09-03, bulgu 2.1 — DB'ye HAM token değil,
// hash(rawToken) yazılır (bkz. lib/auth.ts:hashToken). Çağırana (çereze)
// dönen sessionToken hâlâ ham değer — yalnızca DEPOLAMA değişti.
export async function createUserSession(input: CreateSessionInput): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionId = newId();
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(userSessions).values({
    id: sessionId, companyId: input.companyId, userId: input.userId, sessionToken: hashToken(sessionToken),
    ip: input.ip, userAgent: input.userAgent ?? '', deviceLabel: input.deviceLabel ?? '', expiresAt
  });
  return { sessionId, sessionToken };
}

export async function validateUserSession(sessionId: string, rawToken: string) {
  const [row] = await db.select().from(userSessions).where(eq(userSessions.id, sessionId)).limit(1);
  if (!row) return null;
  if (row.revoked) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (!tokensMatch(hashToken(rawToken), row.sessionToken)) return null;
  return row;
}

// Sayfa render'ında "her istekte tek sorgu" prensibini bozmamak için
// bilinçli olarak fire-and-forget — okuma yolu bundan etkilenmez.
export function touchSessionActivity(sessionId: string): void {
  db.update(userSessions).set({ lastActivityAt: new Date() }).where(eq(userSessions.id, sessionId)).catch(() => {});
}

export async function revokeSession(companyId: string, sessionId: string, revokedByUserId: string): Promise<void> {
  await db.update(userSessions).set({ revoked: true, revokedAt: new Date(), revokedByUserId }).where(and(eq(userSessions.id, sessionId), eq(userSessions.companyId, companyId)));
}

// madde 15 — "kayıp cihaz" senaryosu: kullanıcının KENDİ hesabındaki
// DİĞER tüm aktif oturumları iptal eder (şu anki hariç).
export async function revokeOtherSessions(companyId: string, userId: string, currentSessionId: string, revokedByUserId: string): Promise<void> {
  await db.update(userSessions).set({ revoked: true, revokedAt: new Date(), revokedByUserId })
    .where(and(eq(userSessions.companyId, companyId), eq(userSessions.userId, userId), ne(userSessions.id, currentSessionId), eq(userSessions.revoked, false)));
}

export async function listActiveSessions(companyId: string, userId: string) {
  return db.select().from(userSessions).where(and(eq(userSessions.companyId, companyId), eq(userSessions.userId, userId), eq(userSessions.revoked, false), gt(userSessions.expiresAt, new Date())));
}

// Faz 4 admin görünümü — şirket genelinde aktif oturumlar (madde 37
// Security Admin'in "session" yönetimi).
export async function listCompanyActiveSessions(companyId: string) {
  return db
    .select({ id: userSessions.id, userId: userSessions.userId, userName: users.fullName, ip: userSessions.ip, userAgent: userSessions.userAgent, deviceLabel: userSessions.deviceLabel, createdAt: userSessions.createdAt, lastActivityAt: userSessions.lastActivityAt, expiresAt: userSessions.expiresAt })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.companyId, companyId), eq(userSessions.revoked, false), gt(userSessions.expiresAt, new Date())));
}
