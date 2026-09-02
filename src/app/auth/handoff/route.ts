import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { verifyExternalHandoffToken, setSessionCookie } from '@/lib/session';
import { createUserSession } from '@/lib/security/sessions';
import { writeAuditLog } from '@/lib/security/audit';

// emakerp'in giriş-yönlendirmesinin son adımı — kullanıcı burada şifreyi
// TEKRAR GİRMEZ, token zaten emakfabrika tarafında doğrulanmış bir kimliği
// taşıyor (lib/integration/external-auth.ts:issueExternalHandoffToken).
// Route Handler olması BİLİNÇLİ: çerez yazma (setSessionCookie) yalnızca
// Server Action/Route Handler içinde yapılabilir, düz bir Server
// Component sayfasında YAPILAMAZ.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? await verifyExternalHandoffToken(token) : null;
  if (!payload) return NextResponse.redirect(new URL('/login', request.url));

  // Token 60 saniye önce üretilmiş olabilir — kullanıcı o aralıkta
  // pasifleştirilmiş/MFA açılmış olabilir, bu yüzden TEKRAR kontrol
  // edilir (issueExternalHandoffToken'daki kontrole KÖRÜ KÖRÜNE
  // güvenilmez).
  const [user] = await db.select({ id: users.id, active: users.active, mfaEnabled: users.mfaEnabled }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user || !user.active || user.mfaEnabled) return NextResponse.redirect(new URL('/login', request.url));

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const { sessionId, sessionToken } = await createUserSession({ companyId: payload.companyId, userId: payload.userId, ip, userAgent });
  await setSessionCookie({ sessionId, userId: payload.userId, companyId: payload.companyId, sessionToken });
  await writeAuditLog({ companyId: payload.companyId, userId: payload.userId, action: 'LOGIN', entity: 'USER', entityId: payload.userId, module: 'SECURITY', riskLevel: 'LOW', ip, device: userAgent, changedFields: { via: 'EMAKERP_HANDOFF' } });

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
