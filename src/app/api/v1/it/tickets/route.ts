import { NextResponse } from 'next/server';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { listTickets } from '@/lib/it/tickets';

// Faz 17 (Mobile) — ITAndroid'in Ticket Listesi ekranı. it/assets rotasıyla
// AYNI desen: ?departmentId=... zorunlu (aktif departman client'ta tutulur).
// listTickets şirket geneli (departman filtresi YOK — web tarafı da aynı,
// bkz. app/dashboard/.../it/tickets/page.tsx), durum/öncelik filtresi
// isteğe bağlı query param olarak geçiliyor.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) return NextResponse.json({ error: 'departmentId gereklidir.' }, { status: 400 });

  const auth = await requireMobileDepartmentAccess(request, departmentId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const status = searchParams.get('status') || undefined;
  const priority = searchParams.get('priority') || undefined;
  const tickets = await listTickets(auth.user.companyId, { status, priority });
  return NextResponse.json({ tickets });
}
