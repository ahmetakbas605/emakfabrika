import { NextResponse } from 'next/server';
import { requireMobileUser, mobileLogout } from '@/lib/mobile-auth';

export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await mobileLogout(auth.user.id);
  return NextResponse.json({ ok: true });
}
