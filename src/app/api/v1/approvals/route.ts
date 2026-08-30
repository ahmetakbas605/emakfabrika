import { NextResponse } from 'next/server';
import { requireMobileUser } from '@/lib/mobile-auth';
import { listPendingApprovalsForUser } from '@/lib/workflow/engine';

// Mobil Onay Kutusu — web'in /dashboard/approvals İLE AYNI çağrı
// (listPendingApprovalsForUser), AMA departman-bazlı DEĞİL: web tarafı da
// requireSession kullanıyor, requireDepartmentAccess değil — bir onay,
// onaylayanın hangi departmana atandığından BAĞIMSIZ (pozisyon/yönetici
// zincirine göre çözümleniyor, workflow motorunun kendi mantığı). Bu yüzden
// mobilde de departmentId parametresi İSTENMİYOR, tıpkı web'deki gibi.
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const pending = await listPendingApprovalsForUser(auth.user.companyId, auth.user.id);
  return NextResponse.json({ approvals: pending });
}
