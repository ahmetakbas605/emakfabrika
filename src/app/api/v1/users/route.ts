import { NextResponse } from 'next/server';
import { requireMobileUser } from '@/lib/mobile-auth';
import { listCompanyUsers } from '@/lib/dal';

// Onay Kutusu'nun "Devret" seçicisi için — web'in AYNI listCompanyUsers'ı.
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const users = await listCompanyUsers(auth.user.companyId);
  return NextResponse.json({ users });
}
