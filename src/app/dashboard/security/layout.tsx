import { requireSession } from '@/lib/dal';
import { logout } from '@/actions/auth';
import { DimensionShell, type NavGroup } from '@/components/shell/DimensionShell';

const NAV: NavGroup[] = [
  { label: 'Genel', items: [{ href: '/dashboard', label: 'Ana Panel', icon: 'dashboard' }] },
  {
    label: 'Core Security', items: [
      { href: '/dashboard/security', label: 'Güvenlik Paneli', icon: 'shield' },
      { href: '/dashboard/security/audit', label: 'Audit Trail', icon: 'scroll' },
      { href: '/dashboard/security/events', label: 'Güvenlik Olayları', icon: 'alert' },
      { href: '/dashboard/security/mfa', label: 'MFA (Benim)', icon: 'key' },
      { href: '/dashboard/security/sessions', label: 'Oturumlar / Cihazlar', icon: 'phone' },
      { href: '/dashboard/security/classification', label: 'Veri Sınıflandırma', icon: 'fileSearch' },
      { href: '/dashboard/security/retention', label: 'Saklama / Legal Hold', icon: 'archive' },
      { href: '/dashboard/security/requests', label: 'KVKK Talepleri', icon: 'shieldQuestion' },
      { href: '/dashboard/security/sod', label: 'Görevler Ayrılığı', icon: 'gitBranch' },
      { href: '/dashboard/security/break-glass', label: 'Break-Glass Erişim', icon: 'lock' }
    ]
  }
];

export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <DimensionShell navGroups={NAV} brand="emakfabrika" brandHref="/dashboard" companyName={session.companyName} userName={session.fullName} logoutAction={logout}>
      {children}
    </DimensionShell>
  );
}
