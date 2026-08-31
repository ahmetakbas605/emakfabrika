import { requireSession } from '@/lib/dal';
import { listUserDepartmentAccess } from '@/lib/permissions';
import { listCompanyDepartments } from '@/lib/departments';
import { listPendingApprovalsForUser } from '@/lib/workflow/engine';
import { listLeaveRequests } from '@/lib/hr/leave';
import { logout } from '@/actions/auth';
import { AuroraShell, type NavGroup } from '@/components/shell/AuroraShell';
import { StatCard } from '@/components/shell/StatCard';
import { PageHeader, GlassPanel } from '@/components/shell/ui';
import { ShieldCheck, PalmtreeIcon, ArrowUpRight, Boxes, Landmark, Users2, Settings2, Building2 } from 'lucide-react';
import Link from 'next/link';

const NAV: NavGroup[] = [
  { label: 'Genel', items: [{ href: '/dashboard', label: 'Panel', icon: 'dashboard' }, { href: '/dashboard/approvals', label: 'Onay Kutusu', icon: 'inbox' }] },
  { label: 'Güvenlik', items: [{ href: '/dashboard/security', label: 'Core Security', icon: 'shield' }] }
];

const QUICK_LINKS = [
  { href: '/dashboard/sales', label: 'Satış & CRM', icon: Landmark },
  { href: '/dashboard/production', label: 'Üretim', icon: Boxes },
  { href: '/dashboard/mrp', label: 'MRP', icon: Landmark },
  { href: '/dashboard/mes', label: 'MES / OEE', icon: Boxes },
  { href: '/dashboard/quality', label: 'Kalite / NCR', icon: ShieldCheck },
  { href: '/dashboard/eam', label: 'EAM / Bakım', icon: Boxes },
  { href: '/dashboard/eam/energy', label: 'Enerji Tüketimi', icon: Landmark },
  { href: '/dashboard/fleet', label: 'Filo / Araç Bakım', icon: Boxes },
  { href: '/dashboard/fleet/expenses', label: 'Araç Giderleri', icon: Landmark },
  { href: '/dashboard/projects', label: 'Proje Yönetimi', icon: Boxes },
  { href: '/dashboard/legal', label: 'Hukuk', icon: ShieldCheck },
  { href: '/dashboard/legal/risks', label: 'Risk Kaydı', icon: ShieldCheck },
  { href: '/dashboard/procurement', label: 'Satınalma Talepleri', icon: Boxes },
  { href: '/dashboard/procurement/dashboard', label: 'Satınalma Kontrol Paneli', icon: Landmark },
  { href: '/dashboard/procurement/tenders', label: 'İhaleler', icon: Landmark },
  { href: '/dashboard/hr/leave', label: 'İzin Taleplerim', icon: PalmtreeIcon },
  { href: '/dashboard/hr/overtime', label: 'Fazla Mesai Taleplerim', icon: Users2 }
];

const ADMIN_LINKS = [
  { href: '/dashboard/master-data/parties', label: 'Master Data (Cari/Ürün/Birim/Döviz)', icon: Boxes },
  { href: '/dashboard/org', label: 'Organizasyon', icon: Users2 },
  { href: '/dashboard/workflow/rules', label: 'Onay Kuralları', icon: Settings2 },
  { href: '/dashboard/procurement/scoring-weights', label: 'Skorlama Ağırlıkları', icon: Settings2 },
  { href: '/dashboard/security', label: 'Core Security Yönetimi', icon: ShieldCheck }
];

export default async function DashboardPage() {
  const session = await requireSession();

  const items = session.isFactoryAdmin
    ? (await listCompanyDepartments(session.companyId)).map((d) => ({ departmentId: d.id, departmentName: d.name, roleName: 'Fabrika Yöneticisi' }))
    : (await listUserDepartmentAccess(session.id)).map((a) => ({ departmentId: a.departmentId, departmentName: a.departmentName, roleName: a.roleName }));

  const [pendingApprovals, myLeaveRequests] = await Promise.all([
    listPendingApprovalsForUser(session.companyId, session.id),
    session.employeeId ? listLeaveRequests(session.companyId, session.employeeId) : Promise.resolve([])
  ]);
  const openLeaveCount = myLeaveRequests.filter((r) => r.status === 'DRAFT' || r.status === 'SUBMITTED').length;

  return (
    <AuroraShell navGroups={NAV} brand="emakfabrika" brandHref="/dashboard" companyName={session.companyName} userName={session.fullName} logoutAction={logout}>
      <PageHeader eyebrow={`Hoş geldin, ${session.fullName.split(' ')[0]}`} title={session.companyName} description={session.isFactoryAdmin ? 'Fabrika Yöneticisi — şirketin tüm departmanlarına tam erişim.' : 'Kendi departman ve taleplerinize genel bakış.'} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bekleyen Onaylarım" value={pendingApprovals.length} icon="inbox" accent="cyan" delay={0} />
        <StatCard label="Departmanlarım" value={items.length} icon="building" accent="violet" delay={0.05} />
        <StatCard label="Açık İzin Taleplerim" value={openLeaveCount} icon="palmtree" accent="emerald" delay={0.1} />
        <StatCard label="Rol" value={session.isFactoryAdmin ? 1 : 0} suffix={session.isFactoryAdmin ? '· Admin' : '· Personel'} icon="shield" accent="warn" delay={0.15} />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <GlassPanel title="Departmanlarım" className="md:col-span-2">
          {items.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--aurora-text-dim)' }}>Henüz hiçbir departmana atanmadınız.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {items.map((a) => (
                <Link key={a.departmentId} href={`/dashboard/departments/${a.departmentId}`} className="group flex items-center justify-between px-3.5 py-3 rounded-xl border transition-colors" style={{ borderColor: 'var(--aurora-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <div className="text-sm font-medium">{a.departmentName}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-dim)' }}>{a.roleName}</div>
                  </div>
                  <ArrowUpRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--aurora-cyan)' }} />
                </Link>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel title="Hızlı Erişim">
          <div className="space-y-1.5">
            {QUICK_LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/[0.05]" style={{ color: 'var(--aurora-text-dim)' }}>
                  <Icon size={15} /> {l.label}
                </Link>
              );
            })}
          </div>
        </GlassPanel>

        {session.isFactoryAdmin ? (
          <GlassPanel title="Yönetim" className="md:col-span-3">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(session.isHoldingAdmin ? [...ADMIN_LINKS, { href: '/dashboard/holding', label: 'Holding Yönetimi', icon: Building2 }] : ADMIN_LINKS).map((l) => {
                const Icon = l.icon;
                return (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-colors hover:border-[var(--aurora-border-strong)]" style={{ borderColor: 'var(--aurora-border)', background: 'rgba(255,255,255,0.02)' }}>
                    <Icon size={16} style={{ color: 'var(--aurora-violet)' }} /> <span className="text-sm">{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </GlassPanel>
        ) : null}
      </div>
    </AuroraShell>
  );
}
