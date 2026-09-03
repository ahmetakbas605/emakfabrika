'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ICONS, type IconName } from './icons';

// Görsel Yenileme Faz 2 — modül İÇİ gezinme şeridi.
//
// Neden var: /dashboard/layout.tsx TÜM sayfaları tek bir kabukla sarıyor.
// Daha önce kendi kabuğunu (ve kenar çubuğunu) kuran modüller — Core
// Security'nin 9 maddelik menüsü gibi — o kabuk kaldırılınca gezinmesiz
// kalırdı. Bu bileşen o menüyü, ana kabuğun üstüne İKİNCİ bir kenar
// çubuğu koymadan taşır.
//
// Faz 4: ALT BAŞLIK desteği eklendi. Kullanıcının verdiği menü ağacında
// bir birim kendi içinde bölünüyor (Bilgi Sistemleri -> Donanım/Yazılım,
// Muhasebe & Finans -> Finans/Vezne/Stok/Genel Muhasebe). 18 maddeyi tek
// sırada göstermek o yapıyı görünmez kılıyordu; artık gruplar ayrı
// satırlarda, başlıklarıyla.

export interface SubNavItem {
  href: string;
  label: string;
  icon?: IconName;
}

export interface SubNavGroup {
  label: string;
  items: SubNavItem[];
}

function NavStrip({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="dim-scrollbar flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + '/');
        const Icon = item.icon ? ICONS[item.icon] : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="dim-technical flex shrink-0 items-center gap-2 px-4 py-2 transition-colors"
            style={{
              borderRadius: 'var(--dim-radius-pill)',
              background: active ? 'var(--dim-frosted)' : 'transparent',
              border: `1px solid ${active ? 'var(--dim-border)' : 'transparent'}`,
              color: active ? 'var(--dim-bone)' : 'var(--dim-slate)'
            }}
          >
            {Icon ? <Icon size={14} strokeWidth={1.5} /> : null}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

// Düz liste VEYA gruplu liste kabul eder — çağıranların çoğu (Core
// Security, Ana Veri) tek düzey, departmanlar ise gruplu.
export function SubNav({ items, groups }: { items?: SubNavItem[]; groups?: SubNavGroup[] }) {
  if (groups && groups.length > 0) {
    return (
      <nav className="mb-8 flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>{group.label}</span>
            <NavStrip items={group.items} />
          </div>
        ))}
      </nav>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <nav className="mb-8">
      <NavStrip items={items} />
    </nav>
  );
}
