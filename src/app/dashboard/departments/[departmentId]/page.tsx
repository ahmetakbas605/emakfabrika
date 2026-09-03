import Link from 'next/link';
import { requireDepartmentAccess } from '@/lib/dal';
import { departmentNav, departmentTypeLabel } from '@/lib/department-nav';
import { PageHeader } from '@/components/shell/ui';
import { ICONS } from '@/components/shell/icons';

// Bu sayfa DAHA ÖNCE YOKTU — kullanıcı 404 aldığını bildirdi ve haklıydı.
//
// Ana paneldeki "Departmanlarım" listesi ta baştan beri
// /dashboard/departments/{id} adresine bağlanıyordu, ama o rotada yalnızca
// bir layout.tsx vardı, page.tsx yoktu. Next.js'te layout tek başına bir
// sayfa üretmez; sonuç 404. Yani departman ağacının TAMAMI (Muhasebe,
// Depo, IT, İK — 47 sayfa) pratikte erişilemezdi: içindeki bir alt
// sayfanın tam adresini elle yazmak dışında giriş kapısı yoktu.
//
// Buradaki liste layout'un yatay şeridiyle AYNI kaynaktan geliyor
// (lib/department-nav.ts), yani ikisi asla birbirinden ayrı düşemez.

export default async function DepartmentHomePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { access } = await requireDepartmentAccess(departmentId);
  const groups = departmentNav(departmentId, access.departmentTypeCode);

  return (
    <>
      <PageHeader
        eyebrow={departmentTypeLabel(access.departmentTypeCode)}
        title={access.departmentName}
        description={`Bu departmandaki rolünüz: ${access.roleName}. Aşağıdan bir ekran seçin.`}
      />

      {groups.length === 0 ? (
        <p className="dim-body" style={{ color: 'var(--dim-on-surface-variant)' }}>
          Bu departman türü ({departmentTypeLabel(access.departmentTypeCode)}) için henüz ekran tanımlanmadı.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="dim-metric mb-4" style={{ color: 'var(--dim-sunset)' }}>{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon ? ICONS[item.icon] : null;
                  return (
                    <Link key={item.href} href={item.href} className="dim-card flex items-center gap-4 p-5">
                      {Icon ? (
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{ background: 'var(--dim-frosted-soft)', borderRadius: 'var(--dim-radius-ui)', color: 'var(--dim-cobalt)' }}
                        >
                          <Icon size={18} strokeWidth={1.5} />
                        </span>
                      ) : null}
                      <span className="dim-subheading" style={{ color: 'var(--dim-bone)' }}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

    </>
  );
}
