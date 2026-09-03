import { SubNav } from '@/components/shell/SubNav';
import { requireDepartmentAccess } from '@/lib/dal';
import { departmentNav } from '@/lib/department-nav';

export default async function DepartmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { access } = await requireDepartmentAccess(departmentId);
  // Menü tablosu artık lib/department-nav.ts'te — departman ANA
  // SAYFASI da aynı listeyi kart olarak gösteriyor, kopyalanmasın.
  const navGroups = departmentNav(departmentId, access.departmentTypeCode);

  return (
    <>
      {/* Görsel Yenileme Faz 2: buradaki kendi başlık çubuğu kaldırıldı.
          /dashboard/layout.tsx artık her sayfaya markayı ve ana menüyü
          zaten koyuyordu — ikinci bir "emakfabrika" bağlantısı ve ikinci
          bir üst çubuk tekrardı. Kalan bilgi (hangi departman, hangi rol)
          değerli olduğu için bağlam satırı olarak korundu.
          `fontFamily: system-ui` override'ı da kaldırıldı; Dimension'ın
          kendi yazı tiplerini eziyordu. */}
      <div className="mb-6">
        <span className="dim-metric" style={{ color: 'var(--dim-sunset)' }}>{access.departmentName}</span>
        <span className="dim-technical ml-3" style={{ color: 'var(--dim-slate)' }}>{access.roleName}</span>
      </div>

      {navGroups.length > 0 ? <SubNav groups={navGroups} /> : null}

      {children}
    </>
  );
}
