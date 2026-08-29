import { NextResponse } from 'next/server';
import { requireMobileDepartmentAccess } from '@/lib/mobile-auth';
import { listAssets } from '@/lib/it/assets';

// Saha teknisyeninin tabletindeki ITAndroid uygulaması bu ucu kullanır —
// query: ?departmentId=... (mobil oturumda "aktif departman" seçimi client
// tarafında tutulur, emakadroid'deki org seçim deseniyle aynı).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) return NextResponse.json({ error: 'departmentId gereklidir.' }, { status: 400 });

  const auth = await requireMobileDepartmentAccess(request, departmentId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const assets = await listAssets(auth.user.companyId);
  return NextResponse.json({ assets });
}
