'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ICONS, type IconName } from './icons';

// Görsel Yenileme Faz 2 — modül İÇİ gezinme şeridi.
//
// Neden var: /dashboard/layout.tsx artık TÜM sayfaları tek bir kabukla
// sarıyor. Daha önce kendi kabuğunu (ve dolayısıyla kendi kenar
// çubuğunu) kuran modüller — ör. Core Security'nin 9 maddelik alt
// menüsü — o kabuk kaldırılınca gezinmesiz kalırdı. Bu bileşen o
// menüyü kaybetmeden, ana kabuğun üstüne İKİNCİ bir kenar çubuğu
// koymadan taşır.
//
// Görsel dil Stitch'in hap (pill) nav öğesiyle AYNI, yalnızca yatay ve
// bir tık daha küçük — ana menüyle yarışmasın diye aktif durum dolu
// beyaz değil, buzlu kapsül.

export interface SubNavItem {
  href: string;
  label: string;
  icon?: IconName;
}

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="dim-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
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
    </nav>
  );
}
