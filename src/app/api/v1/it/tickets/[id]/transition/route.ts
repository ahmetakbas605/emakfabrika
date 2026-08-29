import { NextResponse } from 'next/server';
import * as z from 'zod';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { transitionTicket } from '@/lib/it/tickets';
import { revertAssetAfterMaintenanceIfApplicable } from '@/lib/it/maintenance';
import { ItError } from '@/lib/it/errors';

const BodySchema = z.object({ departmentId: z.string().min(1), toStatus: z.string().min(1), note: z.string().optional() });

// Faz 17 (Mobile) — saha teknisyeninin sahadaki asıl akışı: ASSIGNED ->
// ON_THE_WAY -> ARRIVED -> INSPECTION -> WORKING -> ... TICKET_TRANSITIONS
// (lib/it/tickets.ts) web ile AYNI durum makinesi, mobil AYRI bir kural
// seti UYGULAMIYOR. actions/it/tickets.ts:transitionTicketAction İLE AYNI
// CLOSED yan etkisi (bakım varlığının otomatik IN_SERVICE'e dönmesi) burada
// da tetikleniyor — web/mobil davranış farkı olmasın diye.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'departmentId ve toStatus gereklidir.' }, { status: 400 });

  const auth = await requireMobileDepartmentAccess(request, parsed.data.departmentId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.access.permissions.update) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });

  try {
    await transitionTicket(auth.user.companyId, id, parsed.data.toStatus, auth.user.id, parsed.data.note);
    if (parsed.data.toStatus === 'CLOSED') {
      await revertAssetAfterMaintenanceIfApplicable(auth.user.companyId, id, auth.user.id);
    }
  } catch (e) {
    if (e instanceof ItError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
