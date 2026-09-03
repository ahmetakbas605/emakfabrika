import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listCompanyDepartments } from '@/lib/departments';
import { listUserDepartmentAccess } from '@/lib/permissions';
import { departmentTypeLabel } from '@/lib/department-nav';
import { PageHeader } from '@/components/shell/ui';
import { Building2 } from 'lucide-react';

// Departman listesi — bu sayfa da DAHA ÖNCE YOKTU.
//
// Departman ağacına girmenin tek yolu ana paneldeki "Departmanlarım"
// kutusuydu; yan menüde hiç görünmüyordu. Artık yan menüde "Departmanlar"
// var ve buraya düşüyor.
//
// Kimin hangi departmanı gördüğü ana paneldeki (dashboard/page.tsx) AYNI
// kuralla belirleniyor — bilinçli olarak kopyalanmadı, aynı iki
// fonksiyondan besleniyor: fabrika/holding yöneticisi şirketin TÜM
// departmanlarını, diğer herkes YALNIZCA kendisine atanmış olanları görür
// (bkz. lib/permissions.ts:listUserDepartmentAccess). Yetki kontrolü
// ayrıca departmanın kendi sayfasında da yapılır — bu liste bir kısayol,
// güvenlik sınırı DEĞİL.

export default async function DepartmentsPage() {
  const session = await requireSession();
  const seesAll = session.isFactoryAdmin || session.isHoldingAdmin;

  const items = seesAll
    ? (await listCompanyDepartments(session.companyId)).map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        departmentTypeCode: d.departmentTypeCode,
        roleName: session.isHoldingAdmin ? 'Holding Yöneticisi' : 'Fabrika Yöneticisi'
      }))
    : (await listUserDepartmentAccess(session.id)).map((a) => ({
        departmentId: a.departmentId,
        departmentName: a.departmentName,
        departmentTypeCode: a.departmentTypeCode,
        roleName: a.roleName
      }));

  return (
    <>
      <PageHeader
        eyebrow="Birimler"
        title="Departmanlar"
        description={
          seesAll
            ? 'Şirketin tüm departmanları. Bir departmana girdiğinizde o birime ait ekranlar (Muhasebe, Depo, Bilgi İşlem, İK) açılır.'
            : 'Size atanmış departmanlar. Bir departmana girdiğinizde o birime ait ekranlar açılır.'
        }
      />

      {items.length === 0 ? (
        <p className="dim-body" style={{ color: 'var(--dim-on-surface-variant)' }}>
          Henüz hiçbir departmana atanmadınız. Fabrika yöneticinizle görüşün.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.departmentId} href={`/dashboard/departments/${item.departmentId}`} className="dim-card flex flex-col gap-3 p-6">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{ background: 'var(--dim-frosted-soft)', borderRadius: 'var(--dim-radius-ui)', color: 'var(--dim-cobalt)' }}
                >
                  <Building2 size={18} strokeWidth={1.5} />
                </span>
                <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>
                  {departmentTypeLabel(item.departmentTypeCode)}
                </span>
              </div>
              <span className="dim-subheading" style={{ color: 'var(--dim-bone)' }}>{item.departmentName}</span>
              <span className="dim-technical" style={{ color: 'var(--dim-on-surface-variant)' }}>{item.roleName}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
