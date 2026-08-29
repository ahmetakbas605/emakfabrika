import { NextResponse } from 'next/server';
import * as z from 'zod';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { changeAssetStatus } from '@/lib/it/assets';
import { ItError } from '@/lib/it/errors';

const BodySchema = z.object({ departmentId: z.string().min(1), toStatus: z.string().min(1), note: z.string().optional() });

// Saha teknisyeni sahada bir cihazı QR ile taradığında durumunu günceller
// (ör. "Bakımda" -> "Kullanımda") — IT-DATABASE.md §3'teki lifecycle
// kuralı burada da geçerli: sıkı bir geçiş tablosu yok, ama her değişiklik
// it_asset_status_history'e yazılır (lib/it/assets.ts:changeAssetStatus).
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
  if (!auth.access.permissions.manage_assets) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });

  try {
    await changeAssetStatus(auth.user.companyId, id, parsed.data.toStatus, auth.user.id, parsed.data.note);
  } catch (e) {
    if (e instanceof ItError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
