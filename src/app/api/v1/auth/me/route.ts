import { NextResponse } from 'next/server';
import { requireMobileUser, listMobileDepartments } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const departments = await listMobileDepartments(auth.user);
  return NextResponse.json({ user: auth.user, departments });
}
