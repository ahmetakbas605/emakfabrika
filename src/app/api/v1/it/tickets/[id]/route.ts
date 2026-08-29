import { NextResponse } from 'next/server';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { getTicket, getTicketTimeline, TICKET_TRANSITIONS } from '@/lib/it/tickets';
import { ItError } from '@/lib/it/errors';

// Faz 17 (Mobile) — tek ticket + zaman çizelgesi. Web'in AssetDetail
// yorumundaki gibi "ayrı bir tek varlık GET'i yok, listeden filtrele"
// kısayolu burada BİLİNÇLİ OLARAK tercih EDİLMEDİ — bir ticket'ın zaman
// çizelgesi (durum geçmişi/yorumlar/iş kayıtları) tek-liste ucundan
// türetilemeyecek kadar zengin, gerçek bir tek-kayıt GET'i daha doğru.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) return NextResponse.json({ error: 'departmentId gereklidir.' }, { status: 400 });

  const auth = await requireMobileDepartmentAccess(request, departmentId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [ticket, timeline] = await Promise.all([getTicket(auth.user.companyId, id), getTicketTimeline(id)]);
    return NextResponse.json({ ticket, timeline, nextStatuses: TICKET_TRANSITIONS[ticket.status] ?? [] });
  } catch (e) {
    if (e instanceof ItError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
