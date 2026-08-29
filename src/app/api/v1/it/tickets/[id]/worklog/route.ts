import { NextResponse } from 'next/server';
import * as z from 'zod';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { logWork } from '@/lib/it/tickets';
import { ItError } from '@/lib/it/errors';

const BodySchema = z.object({ departmentId: z.string().min(1), minutesSpent: z.number().int().positive(), note: z.string().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'departmentId ve pozitif bir minutesSpent gereklidir.' }, { status: 400 });

  const auth = await requireMobileDepartmentAccess(request, parsed.data.departmentId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.access.permissions.update) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 });

  try {
    await logWork(auth.user.companyId, id, auth.user.id, parsed.data.minutesSpent, parsed.data.note);
  } catch (e) {
    if (e instanceof ItError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
